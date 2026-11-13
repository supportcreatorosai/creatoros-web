"""Local SadTalker render service for CreatorOS.

Turns one presenter photo plus narration audio into a talking-head MP4. It binds to
localhost by default, requires a bearer token and renders one job at a time so it
fits in a 4 GB GPU. The Next.js app submits jobs, polls them, copies the finished
MP4 into private storage and then deletes the job here.
"""

import base64
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
SADTALKER_DIR = os.path.abspath(os.environ.get("SADTALKER_DIR", os.path.join(HERE, "SadTalker")))
WORK_DIR = os.path.abspath(os.environ.get("TALKING_HEAD_WORK_DIR", os.path.join(HERE, "jobs")))
TOKEN = os.environ.get("TALKING_HEAD_TOKEN", "")
HOST = os.environ.get("TALKING_HEAD_HOST", "127.0.0.1")
PORT = int(os.environ.get("TALKING_HEAD_PORT", "7861"))
SIZE = 256  # The 512 model needs more memory than a 4 GB GPU has.
PREPROCESS = os.environ.get("TALKING_HEAD_PREPROCESS", "full")  # "full" keeps the whole photo; "crop" returns the face only.
BATCH_SIZE = int(os.environ.get("TALKING_HEAD_BATCH_SIZE", "2"))
MAX_IMAGE_SIDE = int(os.environ.get("TALKING_HEAD_MAX_IMAGE_SIDE", "1024"))
MAX_BODY_BYTES = 48 * 1024 * 1024
MAX_AUDIO_SECONDS = 300
JOB_TTL_SECONDS = 6 * 3600
MAX_JOBS = 50

JOB_ID = re.compile(r"^[a-f0-9]{32}$")
jobs = OrderedDict()  # id -> {"status", "error", "video", "created", "updated"}
jobs_lock = threading.Lock()
work_ready = threading.Condition(jobs_lock)
pending = []
models = {}


class RenderError(Exception):
    """A user-facing render failure (bad photo or audio), as opposed to a server fault."""


def log(message):
    print(time.strftime("[%H:%M:%S]"), message, flush=True)


def load_models():
    import torch
    sys.path.insert(0, SADTALKER_DIR)
    os.chdir(SADTALKER_DIR)  # SadTalker resolves weights and configs relative to its checkout.
    from src.utils.init_path import init_path
    from src.utils.preprocess import CropAndExtract
    from src.test_audio2coeff import Audio2Coeff
    from src.facerender.animate import AnimateFromCoeff
    # Imported here so missing dependencies fail at startup, not on the first job.
    import src.generate_batch  # noqa: F401
    import src.generate_facerender_batch  # noqa: F401

    device = "cuda" if torch.cuda.is_available() else "cpu"
    paths = init_path(os.path.join(SADTALKER_DIR, "checkpoints"), os.path.join(SADTALKER_DIR, "src", "config"), SIZE, False, PREPROCESS)
    started = time.time()
    models.update(
        device=device,
        preprocess=CropAndExtract(paths, device),
        audio2coeff=Audio2Coeff(paths, device),
        animate=AnimateFromCoeff(paths, device),
    )
    name = torch.cuda.get_device_name(0) if device == "cuda" else "CPU (slow)"
    log(f"SadTalker {SIZE}px/{PREPROCESS} loaded on {name} in {time.time() - started:.1f}s")


def run_ffmpeg(*args):
    result = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()[:500]}")


def audio_seconds(path):
    import wave
    with wave.open(path, "rb") as audio:
        return audio.getnframes() / float(audio.getframerate())


def prepare_inputs(job_dir, image_bytes, audio_bytes, speed):
    from PIL import Image, ImageOps
    image_path = os.path.join(job_dir, "source.png")
    try:
        with Image.open(_bytes_io(image_bytes)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            width, height = image.size
            # H.264 needs even dimensions.
            image = image.crop((0, 0, width - width % 2, height - height % 2))
            image.save(image_path)
    except Exception as error:
        raise RenderError("The presenter photo could not be read. Use a JPG or PNG image.") from error

    raw_audio = os.path.join(job_dir, "narration-source.wav")
    with open(raw_audio, "wb") as handle:
        handle.write(audio_bytes)
    audio_path = os.path.join(job_dir, "narration.wav")
    tempo = [] if abs(speed - 1) < 0.01 else ["-filter:a", f"atempo={speed:.2f}"]
    try:
        run_ffmpeg("-i", raw_audio, *tempo, "-ac", "1", "-ar", "16000", audio_path)
    except RuntimeError as error:
        raise RenderError("The narration audio could not be read.") from error
    seconds = audio_seconds(audio_path)
    if seconds < 0.5:
        raise RenderError("The narration audio is too short.")
    if seconds > MAX_AUDIO_SECONDS:
        raise RenderError(f"Narration is limited to {MAX_AUDIO_SECONDS // 60} minutes. Use a shorter script.")
    return image_path, audio_path


def _bytes_io(data):
    import io
    return io.BytesIO(data)


# "long" is landscape 16:9 (notes left, presenter right); "short" is vertical 9:16 (notes above, presenter below).
LAYOUTS = {
    "long": {"w": 1280, "h": 720, "box": 400, "box_x": 1280 - 400 - 64, "box_y": (720 - 400) // 2,
             "text_x": 72, "text_y": 90, "text_w": 1280 - 400 - 180, "text_bottom": 720 - 90, "title": 50, "point": 30, "footer": 22},
    "short": {"w": 1080, "h": 1920, "box": 840, "box_x": (1080 - 840) // 2, "box_y": 1920 - 840 - 190,
              "text_x": 80, "text_y": 150, "text_w": 1080 - 160, "text_bottom": 1920 - 840 - 250, "title": 72, "point": 44, "footer": 30},
}
ACCENT, BACKGROUND, TEXT, MUTED = (217, 70, 239), (14, 16, 26), (245, 246, 250), (160, 166, 185)
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")


def slide_font(size, bold=False):
    from PIL import ImageFont
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]) + ["DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def wrap(draw, text, font, width, max_lines):
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(".,;:") + "…"
    return lines


CARD = (27, 30, 46)


def blend(front, back, amount):
    return tuple(int(f * amount + b * (1 - amount)) for f, b in zip(front, back))


def slide_kind(slide, index, total):
    """The notes are drawn differently by role: opening, example, recap, or numbered steps."""
    title = slide["title"].lower()
    if index == 0:
        return "intro"
    if "example" in title:
        return "example"
    if index == total - 1 or "recap" in title or "summary" in title:
        return "recap"
    return "steps"


def draw_background(draw, w, h):
    """A soft top-to-bottom glow and a dot grid, so slides are not flat colour."""
    for row in range(h):
        draw.line([(0, row), (w, row)], fill=blend(ACCENT, BACKGROUND, 0.10 * (1 - row / h) ** 2))
    step = max(w // 28, 36)
    dot = blend(MUTED, BACKGROUND, 0.16)
    for gx in range(step // 2, w, step):
        for gy in range(step // 2, h, step):
            draw.ellipse([gx - 2, gy - 2, gx + 2, gy + 2], fill=dot)


def draw_check(draw, cx, cy, size, fill):
    draw.line([(cx - size, cy), (cx - size // 3, cy + size * 2 // 3), (cx + size, cy - size * 2 // 3)], fill=fill, width=max(size // 3, 4), joint="curve")


def draw_notes(draw, kind, points, x, y, width, bottom, point_size):
    """Draws the notes as cards, shrinking the text a little rather than dropping a note."""
    for size in range(point_size, int(point_size * 0.6), -2):
        if draw_cards(draw, kind, points, x, y, width, bottom, size, render=False) is not None:
            return draw_cards(draw, kind, points, x, y, width, bottom, size, render=True)
    return draw_cards(draw, kind, points, x, y, width, bottom, int(point_size * 0.6), render=True, clip=True)


def draw_cards(draw, kind, points, x, y, width, bottom, point_size, render, clip=False):
    """Numbered steps joined by arrows, ticked recap, quote callout or plain cards. None when the cards do not fit."""
    font, line_height = slide_font(point_size), int(point_size * 1.32)
    badge = int(point_size * 1.5)
    pad = point_size // 2
    gap = point_size
    text_x = x + pad * 2 + (badge if kind in ("steps", "recap") else 0)
    text_w = width - (text_x - x) - pad
    count = 0
    for number, point in enumerate(points, 1):
        lines = wrap(draw, point, font, text_w - (point_size * 2 if kind == "example" else 0), 3)
        card_h = max(badge, line_height * len(lines)) + pad * 2
        if y + card_h > bottom:
            if clip:
                break
            return None
        if not render:
            y += card_h + gap
            count += 1
            continue
        if kind == "steps" and count:
            mid = x + pad + badge // 2
            draw.line([(mid, y - gap), (mid, y - 4)], fill=ACCENT, width=4)
            draw.polygon([(mid - 9, y - 14), (mid + 9, y - 14), (mid, y - 2)], fill=ACCENT)
        draw.rounded_rectangle([x, y, x + width, y + card_h], radius=22, fill=CARD, outline=blend(ACCENT, CARD, 0.35), width=2)
        centre_y = y + card_h // 2
        if kind == "example":
            draw.rounded_rectangle([x, y, x + 12, y + card_h], radius=6, fill=ACCENT)
        elif kind in ("steps", "recap"):
            cx = x + pad + badge // 2
            draw.ellipse([cx - badge // 2, centre_y - badge // 2, cx + badge // 2, centre_y + badge // 2], fill=ACCENT)
            if kind == "steps":
                draw.text((cx, centre_y), str(number), font=slide_font(point_size, bold=True), fill=TEXT, anchor="mm")
            else:
                draw_check(draw, cx, centre_y, badge // 4, TEXT)
        text_top = centre_y - line_height * len(lines) // 2
        left = text_x + (point_size if kind == "example" else 0)
        for offset, line in enumerate(lines):
            draw.text((left, text_top + offset * line_height), line, font=font, fill=TEXT)
        y += card_h + gap
        count += 1
    return y


def draw_slide(slide, index, total, path, layout):
    """Heading and notes drawn as cards in the text area; the presenter box is drawn as an outlined frame."""
    from PIL import Image, ImageDraw
    w, h, x, text_width = layout["w"], layout["h"], layout["text_x"], layout["text_w"]
    title_size, point_size, footer_size = layout["title"], layout["point"], layout["footer"]
    image = Image.new("RGB", (w, h), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw_background(draw, w, h)
    draw.rectangle([0, 0, w, 8], fill=ACCENT)
    y = layout["text_y"]
    title_font = slide_font(title_size, bold=True)
    for line in wrap(draw, slide["title"], title_font, text_width, 2):
        draw.text((x, y), line, font=title_font, fill=TEXT)
        y += int(title_size * 1.24)
    draw.rectangle([x, y + 14, x + 80, y + 20], fill=ACCENT)
    y += 56
    draw_notes(draw, slide_kind(slide, index, total), slide["points"], x, y, text_width, layout["text_bottom"], point_size)
    footer = slide_font(footer_size)
    draw.text((x, h - footer_size * 2.5), "CreatorOS", font=footer, fill=ACCENT)
    draw.text((w - x - footer_size * 2.4, h - footer_size * 2.5), f"{index + 1} / {total}", font=footer, fill=MUTED)
    bar_y = int(h - footer_size)
    draw.rounded_rectangle([x, bar_y, w - x, bar_y + 8], radius=4, fill=blend(MUTED, BACKGROUND, 0.25))
    draw.rounded_rectangle([x, bar_y, x + int((w - 2 * x) * (index + 1) / total), bar_y + 8], radius=4, fill=ACCENT)
    box, box_x, box_y = layout["box"], layout["box_x"], layout["box_y"]
    draw.rounded_rectangle([box_x - 6, box_y - 6, box_x + box + 6, box_y + box + 6], radius=34, outline=ACCENT, width=4)
    image.save(path)


def media_seconds(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(result.stdout.strip())


def video_size(path):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip().split(",")
    return int(probe[0]), int(probe[1])


def compose_vertical(talking_path, output):
    """Short-form 9:16 without slides: the presenter large over a blurred copy of the same shot."""
    width, height = video_size(talking_path)
    # Wide shots are cropped around the presenter so they fill the vertical frame.
    front = "scale=-2:1500,crop=1080:1500:(iw-1080)/2:0" if width > height * 1.2 else "scale=1080:-2"
    graph = (f"[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2[bg];"
             f"[b]{front}[fg];[bg][fg]overlay=0:(H-h)/2,format=yuv420p[v]")
    run_ffmpeg("-i", talking_path, "-filter_complex", graph, "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-preset", "veryfast",
               "-crf", "21", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output)


def compose_slides(job_dir, talking_path, slides, output, layout):
    """Explainer layout: slides fill the frame, each shown for its share of the narration."""
    from PIL import Image, ImageDraw
    total = media_seconds(talking_path)
    weights = [max(len(slide["narration"]), 1) for slide in slides]
    durations = [total * weight / sum(weights) for weight in weights]
    concat = os.path.join(job_dir, "slides.txt")
    with open(concat, "w", encoding="utf8") as handle:
        for index, (slide, seconds) in enumerate(zip(slides, durations)):
            path = os.path.join(job_dir, f"slide{index}.png")
            draw_slide(slide, index, len(slides), path, layout)
            handle.write(f"file '{path.replace(chr(92), '/')}'\nduration {seconds:.3f}\n")
        handle.write(f"file '{path.replace(chr(92), '/')}'\n")  # The concat demuxer needs the last image repeated.
    box, box_x, box_y = layout["box"], layout["box_x"], layout["box_y"]
    mask = Image.new("L", (box, box), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, box - 1, box - 1], radius=30, fill=255)
    mask_path = os.path.join(job_dir, "mask.png")
    mask.save(mask_path)
    width, height_px = video_size(talking_path)
    # Wide shots (presenter in a room) are zoomed towards the face; portraits are framed as they are.
    zoom = 1.8 if width > height_px * 1.2 else 1.0
    height = int(box * zoom) // 2 * 2
    graph = (f"[0:v]fps=25,format=rgba[bg];"
             f"[1:v]scale=-2:{height},scale='max(iw,{box})':-2,crop={box}:{box}:(iw-{box})/2:(ih-{box})*{0.12 if zoom > 1 else 0.33},format=rgba[face];"
             f"[2:v]format=gray,scale={box}:{box}[mask];[face][mask]alphamerge[avatar];"
             f"[bg][avatar]overlay={box_x}:{box_y}:shortest=1,format=yuv420p[v]")
    run_ffmpeg("-f", "concat", "-safe", "0", "-i", concat, "-i", talking_path, "-loop", "1", "-i", mask_path,
               "-filter_complex", graph, "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", output)


def validate_slides(value):
    if value is None:
        return None
    if not isinstance(value, list) or not 1 <= len(value) <= 8:
        raise ValueError
    slides = []
    for item in value:
        title, points, narration = item.get("title"), item.get("points"), item.get("narration")
        if not (isinstance(title, str) and 0 < len(title.strip()) <= 90 and isinstance(narration, str) and 0 < len(narration) <= 600
                and isinstance(points, list) and len(points) <= 4 and all(isinstance(p, str) and 0 < len(p) <= 140 for p in points)):
            raise ValueError
        slides.append({"title": title.strip(), "points": [p.strip() for p in points], "narration": narration})
    return slides


def render(job_id, job_dir, image_bytes, audio_bytes, speed, slides=None, video_format="long"):
    import torch
    from src.generate_batch import get_data
    from src.generate_facerender_batch import get_facerender_data

    image_path, audio_path = prepare_inputs(job_dir, image_bytes, audio_bytes, speed)
    still = PREPROCESS == "full"
    first_frame_dir = os.path.join(job_dir, "first_frame")
    os.makedirs(first_frame_dir, exist_ok=True)
    with torch.no_grad():
        coeff_path, crop_path, crop_info = models["preprocess"].generate(image_path, first_frame_dir, PREPROCESS, source_image_flag=True, pic_size=SIZE)
        if coeff_path is None:
            raise RenderError("No face was found in the presenter photo. Use a clear, front-facing photo of one person.")
        batch = get_data(coeff_path, audio_path, models["device"], None, still=still)
        motion_path = models["audio2coeff"].generate(batch, job_dir, 0, None)
        data = get_facerender_data(motion_path, crop_path, coeff_path, audio_path, BATCH_SIZE, None, None, None,
                                   expression_scale=1.0, still_mode=still, preprocess=PREPROCESS, size=SIZE)
        rendered = models["animate"].generate(data, job_dir, image_path, crop_info, enhancer=None,
                                              background_enhancer=None, preprocess=PREPROCESS, img_size=SIZE)
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    output = os.path.join(job_dir, "video.mp4")
    talking = os.path.join(job_dir, "talking.mp4") if slides or video_format == "short" else output
    # Browsers need H.264/AAC; SadTalker writes mp4v.
    run_ffmpeg("-i", rendered, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", talking)
    if slides:
        compose_slides(job_dir, talking, slides, output, LAYOUTS[video_format])
    elif video_format == "short":
        compose_vertical(talking, output)
    return output


def update(job_id, **fields):
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(fields, updated=time.time())


def worker():
    while True:
        with work_ready:
            while not pending:
                work_ready.wait()
            job_id, image_bytes, audio_bytes, speed, slides, video_format = pending.pop(0)
            if job_id not in jobs:
                continue
            jobs[job_id].update(status="processing", updated=time.time())
        job_dir = os.path.join(WORK_DIR, job_id)
        started = time.time()
        log(f"job {job_id} started")
        try:
            video = render(job_id, job_dir, image_bytes, audio_bytes, speed, slides, video_format)
            update(job_id, status="done", video=video)
            log(f"job {job_id} done in {time.time() - started:.0f}s")
        except RenderError as error:
            update(job_id, status="error", error=str(error))
            log(f"job {job_id} rejected: {error}")
        except Exception:
            traceback.print_exc()
            update(job_id, status="error", error="The local renderer failed. Check the talking-head server log.")
        finally:
            for name in os.listdir(job_dir) if os.path.isdir(job_dir) else []:
                path = os.path.join(job_dir, name)
                if name != "video.mp4":
                    shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else os.remove(path)


def remove_job(job_id):
    with jobs_lock:
        jobs.pop(job_id, None)
    shutil.rmtree(os.path.join(WORK_DIR, job_id), ignore_errors=True)


def expire_jobs():
    while True:
        time.sleep(300)
        cutoff = time.time() - JOB_TTL_SECONDS
        with jobs_lock:
            expired = [job_id for job_id, job in jobs.items() if job["updated"] < cutoff and job["status"] in ("done", "error")]
        for job_id in expired:
            remove_job(job_id)


def decode_base64(value, limit):
    if not isinstance(value, str) or len(value) > limit * 4 // 3 + 4:
        raise ValueError
    return base64.b64decode(value, validate=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "CreatorOSTalkingHead/1.0"

    def log_message(self, format, *args):
        pass

    def send_json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self):
        supplied = self.headers.get("Authorization", "")
        if hmac.compare_digest(supplied.encode(), f"Bearer {TOKEN}".encode()):
            return True
        self.send_json(401, {"error": "Unauthorized"})
        return False

    def route(self):
        parts = [part for part in self.path.split("?")[0].split("/") if part]
        if len(parts) >= 2 and parts[0] == "jobs" and not JOB_ID.match(parts[1]):
            self.send_json(404, {"error": "Not found"})
            return None
        return parts

    def do_GET(self):
        parts = self.route()
        if parts is None:
            return
        if parts == ["health"]:
            with jobs_lock:
                queued = len(pending)
            return self.send_json(200, {"ok": bool(models), "device": models.get("device"), "queued": queued})
        if not self.authorized():
            return
        if len(parts) in (2, 3) and parts[0] == "jobs":
            with jobs_lock:
                job = dict(jobs.get(parts[1]) or {})
                position = next((index for index, item in enumerate(pending) if item[0] == parts[1]), None)
            if not job:
                return self.send_json(404, {"error": "Job not found"})
            if len(parts) == 2:
                return self.send_json(200, {"status": job["status"], "error": job.get("error"), "position": position})
            if parts[2] == "video" and job["status"] == "done" and os.path.isfile(job.get("video", "")):
                size = os.path.getsize(job["video"])
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(size))
                self.end_headers()
                with open(job["video"], "rb") as handle:
                    shutil.copyfileobj(handle, self.wfile)
                return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        parts = self.route()
        if parts is None or not self.authorized():
            return
        if parts != ["jobs"]:
            return self.send_json(404, {"error": "Not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            return self.send_json(413, {"error": "Request is too large."})
        try:
            body = json.loads(self.rfile.read(length))
            image = decode_base64(body.get("image"), 12 * 1024 * 1024)
            audio = decode_base64(body.get("audio"), 30 * 1024 * 1024)
            speed = float(body.get("speed", 1))
            slides = validate_slides(body.get("slides"))
            video_format = body.get("format", "long")
            if video_format not in LAYOUTS:
                raise ValueError
        except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
            return self.send_json(400, {"error": "Send a base64 image, base64 WAV audio and a speed."})
        if not (0.5 <= speed <= 2):
            return self.send_json(400, {"error": "Speed must be between 0.5 and 2."})
        if not (image[:3] == b"\xff\xd8\xff" or image[:8] == b"\x89PNG\r\n\x1a\n"):
            return self.send_json(400, {"error": "The presenter photo must be a JPG or PNG image."})
        is_wav = audio[:4] == b"RIFF" and audio[8:12] == b"WAVE"
        is_mp3 = audio[:3] == b"ID3" or (audio[:1] == b"\xff" and audio[1] & 0xE0 == 0xE0)
        if not (is_wav or is_mp3):
            return self.send_json(400, {"error": "Narration must be WAV or MP3 audio."})
        job_id = uuid.uuid4().hex
        os.makedirs(os.path.join(WORK_DIR, job_id), exist_ok=True)
        with work_ready:
            if len(jobs) >= MAX_JOBS and len(pending) >= MAX_JOBS // 2:
                return self.send_json(429, {"error": "The renderer queue is full. Try again later."})
            while len(jobs) >= MAX_JOBS:
                oldest = next((key for key, job in jobs.items() if job["status"] in ("done", "error")), None)
                if oldest is None:
                    break
                jobs.pop(oldest)
                shutil.rmtree(os.path.join(WORK_DIR, oldest), ignore_errors=True)
            now = time.time()
            jobs[job_id] = {"status": "queued", "error": None, "created": now, "updated": now}
            pending.append((job_id, image, audio, speed, slides, video_format))
            work_ready.notify()
        log(f"job {job_id} queued ({len(audio) // 1024} KB audio)")
        self.send_json(202, {"id": job_id})

    def do_DELETE(self):
        parts = self.route()
        if parts is None or not self.authorized():
            return
        if len(parts) == 2 and parts[0] == "jobs":
            with jobs_lock:
                processing = jobs.get(parts[1], {}).get("status") == "processing"
                pending[:] = [item for item in pending if item[0] != parts[1]]
            if not processing:
                remove_job(parts[1])
            return self.send_json(200, {"deleted": not processing})
        self.send_json(404, {"error": "Not found"})


def main():
    if len(TOKEN) < 24:
        sys.exit("Set TALKING_HEAD_TOKEN to a random secret of at least 24 characters (the same value as in .env.local).")
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg was not found on PATH.")
    os.makedirs(WORK_DIR, exist_ok=True)
    load_models()
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=expire_jobs, daemon=True).start()
    log(f"Talking-head server listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()

"""Renders one video through the running server and reports how long it took.

Usage: python smoke_test.py PHOTO.(jpg|png) NARRATION.wav OUTPUT.mp4
Reads TALKING_HEAD_TOKEN and TALKING_HEAD_URL from .env.local.
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def env_values():
    values = {}
    with open(os.path.join(HERE, "..", "..", ".env.local"), encoding="utf8") as handle:
        for line in handle:
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.rstrip("\n").split("=", 1)
                values[key.strip()] = value.strip().strip('"')
    return values


def call(url, token, method="GET", body=None):
    request = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def main(photo, audio, output):
    values = env_values()
    base, token = values.get("TALKING_HEAD_URL", "http://127.0.0.1:7861"), values["TALKING_HEAD_TOKEN"]
    with open(photo, "rb") as image_file, open(audio, "rb") as audio_file:
        body = {"image": base64.b64encode(image_file.read()).decode(), "audio": base64.b64encode(audio_file.read()).decode(), "speed": 1}
    started = time.time()
    job = json.loads(call(f"{base}/jobs", token, "POST", body))["id"]
    print(f"queued {job}")
    while True:
        status = json.loads(call(f"{base}/jobs/{job}", token))
        if status["status"] in ("done", "error"):
            break
        time.sleep(3)
    if status["status"] == "error":
        sys.exit(f"render failed after {time.time() - started:.0f}s: {status['error']}")
    with open(output, "wb") as handle:
        handle.write(call(f"{base}/jobs/{job}/video", token))
    call(f"{base}/jobs/{job}", token, "DELETE")
    print(f"done in {time.time() - started:.0f}s -> {output} ({os.path.getsize(output) // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    try:
        main(*sys.argv[1:])
    except urllib.error.URLError as error:
        sys.exit(f"Could not reach the talking-head server ({error}). Is start.ps1 running?")

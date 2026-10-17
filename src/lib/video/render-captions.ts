import { MAX_MEDIA_BYTES } from '../storage/shared';

export type VideoCaption = { word: string; start: number; end: number };

export async function renderCaptionedShort(options: {
  videoUrl: string;
  captions: VideoCaption[];
  style: string;
  signal: AbortSignal;
}): Promise<Blob> {
  const { videoUrl, captions, style, signal } = options;
  signal.throwIfAborted();
  let video: HTMLVideoElement | undefined;
  let audio: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let temporaryUrl: string | undefined;
  let frame = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let clipTimer: ReturnType<typeof setTimeout> | undefined;
  let recordingAborted: (() => void) | undefined;
  try {
    const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor || !window.MediaRecorder) throw new Error('This browser cannot export captioned video.');
    // Run before media fetching so the click authorizes audio playback.
    audio = new Constructor();
    await audio.resume();
    signal.throwIfAborted();
    let sourceUrl = videoUrl;
    if (videoUrl.startsWith('https://')) {
      const response = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}`, { signal });
      if (!response.ok) throw new Error('Could not download the source video.');
      temporaryUrl = URL.createObjectURL(await response.blob());
      sourceUrl = temporaryUrl;
    }
    signal.throwIfAborted();
    video = document.createElement('video');
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    const renderVideo = video;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('The video could not be loaded in time.')), 15000);
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        renderVideo.onloadedmetadata = null;
        renderVideo.onerror = null;
        signal.removeEventListener('abort', aborted);
        if (error) reject(error); else resolve();
      };
      const aborted = () => finish(new DOMException('Export stopped.', 'AbortError'));
      renderVideo.onloadedmetadata = () => finish();
      renderVideo.onerror = () => finish(new Error('Could not read the source video.'));
      signal.addEventListener('abort', aborted, { once: true });
      renderVideo.src = sourceUrl;
    });
    signal.throwIfAborted();
    const width = video.videoWidth, height = video.videoHeight;
    const duration = Math.min(video.duration, 15);
    if (!width || !height || !Number.isFinite(duration) || duration <= 0) throw new Error('The source video is invalid.');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the video renderer.');
    stream = canvas.captureStream(30);
    const source = audio.createMediaElementSource(video);
    const destination = audio.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audio.destination);
    destination.stream.getAudioTracks().forEach(track => stream?.addTrack(track));
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('No supported recording format is available.');
    recorder = new MediaRecorder(stream, { mimeType: mime });
    const activeRecorder = recorder;
    const chunks: BlobPart[] = [];
    let recordedBytes = 0;
    let rejectRecording: (error: Error) => void = () => undefined;
    const finished = new Promise<void>((resolve, reject) => {
      rejectRecording = reject;
      activeRecorder.ondataavailable = event => {
        recordedBytes += event.data.size;
        if (recordedBytes > MAX_MEDIA_BYTES) { reject(new Error('The exported video exceeds 50 MB.')); return; }
        chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error('Video recording failed.'));
      activeRecorder.onstop = () => resolve();
      recordingAborted = () => reject(new DOMException('Export stopped.', 'AbortError'));
      signal.addEventListener('abort', recordingAborted, { once: true });
      watchdog = setTimeout(() => reject(new Error('Video export timed out.')), (duration + 30) * 1000);
    });
    const stopRecording = () => {
      if (activeRecorder.state !== 'inactive') activeRecorder.stop();
      renderVideo.pause();
      cancelAnimationFrame(frame);
    };
    renderVideo.ontimeupdate = () => { if (renderVideo.currentTime >= duration) stopRecording(); };
    renderVideo.onended = stopRecording;
    const draw = () => {
      if (signal.aborted) return;
      try {
        if (renderVideo.ended || renderVideo.currentTime >= duration) {
          stopRecording();
          return;
        }
        context.drawImage(renderVideo, 0, 0, width, height);
        const word = captions.find(caption => renderVideo.currentTime >= caption.start && renderVideo.currentTime <= caption.end)?.word;
        if (word) {
          const fontSize = Math.floor(height * (style === 'Minimal' ? 0.064 : 0.08));
          context.font = `${style === 'Minimal' ? 500 : 900} ${fontSize}px sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'bottom';
          context.fillStyle = style === 'Karaoke' ? '#ec4899' : style === 'Dynamic' ? '#facc15' : 'white';
          context.strokeStyle = 'black';
          context.lineWidth = Math.max(1, Math.floor(fontSize * 0.12));
          const text = style === 'Alex H.' ? word.toUpperCase() : word;
          if (style !== 'Minimal') context.strokeText(text, width / 2, height * 0.85);
          context.fillText(text, width / 2, height * 0.85);
        }
        frame = requestAnimationFrame(draw);
      } catch { rejectRecording(new Error('Could not render a video frame.')); }
    };
    activeRecorder.start(1000);
    await Promise.all([finished, renderVideo.play().then(() => {
      // Frame callbacks can pause in background tabs; keep the narration bounded too.
      clipTimer = setTimeout(stopRecording, duration * 1000);
      frame = requestAnimationFrame(draw);
    })]);
    signal.throwIfAborted();
    if (!recordedBytes) throw new Error('The browser did not record any video.');
    // Storage accepts the container MIME type without MediaRecorder codec parameters.
    return new Blob(chunks, { type: mime.split(';')[0] });
  } finally {
    clearTimeout(watchdog);
    clearTimeout(clipTimer);
    cancelAnimationFrame(frame);
    if (recordingAborted) signal.removeEventListener('abort', recordingAborted);
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    video?.pause();
    if (video) { video.ontimeupdate = null; video.onended = null; }
    video?.removeAttribute('src');
    video?.load();
    stream?.getTracks().forEach(track => track.stop());
    await audio?.close().catch(() => undefined);
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
  }
}

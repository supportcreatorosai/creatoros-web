export const MEDIA_BUCKET = "creator-media";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "audio/wav": "wav",
};

export function assertOwnedMediaPath(path: string, userId: string): void {
  if (!path.startsWith(`${userId}/`) || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm|wav)$/i.test(path)) {
    throw new Error("Invalid media path.");
  }
}

export function mediaExtension(contentType: string): string {
  const extension = MEDIA_EXTENSIONS[contentType];
  if (!extension) throw new Error("Unsupported media format. Use JPEG, PNG, WebP, MP4, WebM, or WAV.");
  return extension;
}

export const VIDEO_VOICES = [
  { id: "en-US-JennyNeural", name: "Jenny · English (US)", gender: "female", geminiVoice: "Kore" },
  { id: "en-GB-AbbiNeural", name: "Abbi · English (UK)", gender: "female", geminiVoice: "Aoede" },
  { id: "en-US-GuyNeural", name: "Guy · English (US)", gender: "male", geminiVoice: "Puck" },
  { id: "en-GB-RyanNeural", name: "Ryan · English (UK)", gender: "male", geminiVoice: "Charon" },
] as const;

export type VideoVoiceId = (typeof VIDEO_VOICES)[number]["id"];
type Gender = (typeof VIDEO_VOICES)[number]["gender"];

const clip = (path: string) => ({
  url: `https://clips-presenters.d-id.com/v2/${path}/image.png`,
  thumbnail: `https://clips-presenters.d-id.com/v2/${path}/thumbnail.png`,
});

/** Stock presenter photos hosted by D-ID; the provider fetches them when rendering. */
export const VIDEO_PRESENTERS: readonly { name: string; url: string; thumbnail: string; gender: Gender; voiceId: VideoVoiceId }[] = [
  { name: "Alice", url: "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg", thumbnail: "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg", gender: "female", voiceId: "en-US-JennyNeural" },
  { name: "Noelle", url: "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.png", thumbnail: "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.png", gender: "female", voiceId: "en-US-JennyNeural" },
  { name: "Amber", ...clip("Amber_BlackJacket_HomeOffice/9WuHtiUDnL/Sc6QllBjEE"), gender: "female", voiceId: "en-US-JennyNeural" },
  { name: "Fiona", ...clip("Fiona_NoHands_BlackJacket_ClassRoom/1BOeggEufb/dbRUIwY6KY"), gender: "female", voiceId: "en-GB-AbbiNeural" },
  { name: "Kayla", ...clip("Kayla_NoHands_BlackShirt_CoffeeShop/u1un3hTUDJ/Oijd6UyS_5"), gender: "female", voiceId: "en-US-JennyNeural" },
  { name: "Alyssa", ...clip("Alyssa_NoHands_RedSuite_Lobby/qtzjxMSwEa/ypTds_0CK3"), gender: "female", voiceId: "en-GB-AbbiNeural" },
  { name: "Adam", ...clip("Adam_BlackShirt_Library/6uEefixtDc/t6GYdxT4rx"), gender: "male", voiceId: "en-US-GuyNeural" },
  { name: "Dylan", ...clip("Dylan_NoHands_GreySuite_Lobby/_R6SxR9pgn/pbQ2A_h5wy"), gender: "male", voiceId: "en-GB-RyanNeural" },
  { name: "Joseph", ...clip("Joseph_NoHands_OrangeShirt_Lab/hfdqirrsX9/35RzcD3TlF"), gender: "male", voiceId: "en-US-GuyNeural" },
  { name: "Frank", ...clip("Frank_NoHands_GreyJacket_CoffeeShop/HT3CCjVvV3/lqbOUGqSDE"), gender: "male", voiceId: "en-GB-RyanNeural" },
];

/** Media Library style label for creator-uploaded presenter photos. */
export const PRESENTER_PHOTO_STYLE = "Presenter photo";
export const MAX_PRESENTER_PHOTO_BYTES = 10 * 1024 * 1024;

/** Short form is vertical 9:16 for Shorts/Reels/TikTok (about a minute); long form is landscape 16:9. */
export const VIDEO_FORMATS = {
  short: { label: "Short form", detail: "Vertical 9:16 · Shorts, Reels, TikTok · up to ~60 s", maxScript: 900 },
  long: { label: "Long form", detail: "Horizontal 16:9 · YouTube, courses", maxScript: 3000 },
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;

export type VideoGenerationOptions = {
  voiceId?: string; speed?: number; name?: string; avatarName?: string; photoPath?: string; format?: VideoFormat;
  /** The creator's own narration file (WAV or MP3, up to 6 MB) instead of a generated voice. */
  audio?: File;
  /** Explainer slides; the narration is their combined text. Rendered by the local renderer only. */
  slides?: { title: string; points: string[]; narration: string }[];
};
export const MAX_VIDEO_SCRIPT_LENGTH = 3000;

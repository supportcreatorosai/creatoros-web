"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { splitSpeechText } from "./text";

export type SpeechPreviewOptions = { voiceName?: string; rate?: number; volume?: number };
export type SpeechPreviewStatus = "idle" | "starting" | "playing" | "complete";

/** Device speech is a preview. It does not produce a downloadable audio file. */
export function useSpeechPreview() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<SpeechPreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [spokenCharacters, setSpokenCharacters] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionRef = useRef(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearStartTimer();
    utteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
    setSpokenCharacters(0);
  }, [clearStartTimer]);

  useEffect(() => {
    let disposed = false;
    const available = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    const loadVoices = () => {
      if (!disposed) {
        setSupported(available);
        if (available) setVoices(window.speechSynthesis.getVoices());
      }
    };
    queueMicrotask(loadVoices);
    if (available) window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    // Some browsers populate voices late without sending the initial event.
    const retries = [250, 1000, 2500].map(delay => setTimeout(loadVoices, delay));
    return () => {
      disposed = true;
      retries.forEach(clearTimeout);
      sessionRef.current += 1;
      clearStartTimer();
      utteranceRef.current = null;
      if (available) {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
        window.speechSynthesis.cancel();
      }
    };
  }, [clearStartTimer]);

  // Call synchronously from a click handler so browsers retain the user gesture.
  const speak = useCallback((rawText: string, options: SpeechPreviewOptions = {}) => {
    stop();
    setError(null);
    const text = rawText.trim();
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setError("Speech preview is unavailable in this browser. Try Chrome or Edge on a device with speech voices installed.");
      return;
    }
    if (!text) { setError("Add some script text to preview."); return; }
    const synth = window.speechSynthesis;
    const session = sessionRef.current;
    const deviceVoices = synth.getVoices();
    const voice = deviceVoices.find(item => item.name === options.voiceName)
      ?? deviceVoices.find(item => item.default);
    const chunks = splitSpeechText(text);
    setStatus("starting");
    // A paused synthesis queue can survive cancelling a previous preview.
    if (synth.paused) synth.resume();

    const speakChunk = (index: number) => {
      if (sessionRef.current !== session) return;
      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utteranceRef.current = utterance; // Retain it until the engine finishes.
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1));
      utterance.volume = Math.min(1, Math.max(0.1, options.volume ?? 1));
      utterance.onstart = () => {
        if (sessionRef.current !== session) return;
        clearStartTimer();
        setStatus("playing");
      };
      utterance.onboundary = event => {
        if (sessionRef.current === session) setSpokenCharacters(chunk.offset + event.charIndex);
      };
      utterance.onend = () => {
        if (sessionRef.current !== session) return;
        clearStartTimer();
        setSpokenCharacters(chunk.offset + chunk.text.length);
        if (index + 1 < chunks.length) speakChunk(index + 1);
        else { utteranceRef.current = null; setStatus("complete"); }
      };
      utterance.onerror = event => {
        if (sessionRef.current !== session) return;
        stop();
        setError(event.error === "not-allowed"
          ? "The browser blocked speech. Click Play preview again and allow audio for this site."
          : `Speech playback failed (${event.error}). Try another device voice and check your audio output.`);
      };
      clearStartTimer();
      startTimerRef.current = setTimeout(() => {
        if (sessionRef.current !== session) return;
        stop();
        setError("Speech did not start. Check your speaker volume, select another voice, and click Play preview again.");
      }, 8000);
      try { synth.speak(utterance); }
      catch { stop(); setError("Could not start speech playback. Try another voice or browser."); }
    };
    speakChunk(0);
  }, [clearStartTimer, stop]);

  return { voices, supported, status, error, spokenCharacters, speak, stop };
}

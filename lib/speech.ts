// The text-to-speech boundary for the Mindset "Listen" button.
//
// THIS is the single swap point. The UI (MindsetCard) depends only on the
// `Speaker` interface below — it never touches the browser speech API directly.
// To swap in a paid voice later (e.g. ElevenLabs), implement `Speaker` with a
// fetch-audio-then-play-via-<audio> version and change the one `export const
// speaker` line at the bottom. The interface + callbacks are async-friendly, so
// a network-backed voice fits without any UI or content changes.

export type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void; // natural end OR cancel
  onError?: () => void;
};

export interface Speaker {
  isSupported(): boolean;
  speak(text: string, handlers?: SpeakHandlers): void;
  cancel(): void;
}

// --- Voice quality selection ---------------------------------------------
// The default browser voice is usually a robotic local one (e.g. Windows
// "David"/"Zira"). Browsers also ship much more human-sounding FREE voices —
// Edge's "… Online (Natural)" neural voices and Chrome's "Google" voice — but
// they must be selected explicitly. We score the available voices and pick the
// most natural English one. All free, no keys, no API calls of our own.

// Preferred voice, by name/voiceURI substring, in priority order. The owner
// chose Edge's "Christopher" natural voice (Azure en-US-ChristopherNeural, shown
// in-browser as "Microsoft Christopher Online (Natural)"). When present it wins
// outright; otherwise we fall back to the best-scored natural voice below. (This
// voice is Edge-only via the Web Speech API — Chrome/other browsers fall back.
// A future Azure/ElevenLabs Speaker could serve Christopher on every browser.)
const PREFERRED_VOICE_HINTS = ["christopher"];

// Higher index = stronger signal of a natural/high-quality voice.
const GOOD_NAME_HINTS = [
  "natural", // Edge neural voices: "Microsoft Aria Online (Natural)"
  "neural",
  "online",
  "google", // Chrome: "Google US English"
  "premium",
  "enhanced",
  "siri",
  "samantha", // good macOS/iOS voice
  "aria",
  "jenny",
  "guy",
  "libby",
  "sonia",
];
// Known robotic local voices to avoid when something better exists.
const BAD_NAME_HINTS = ["david", "zira", "mark", "hazel", "desktop"];

let cachedVoice: SpeechSynthesisVoice | null = null;
let listeningForVoices = false;

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  GOOD_NAME_HINTS.forEach((hint, i) => {
    if (name.includes(hint)) score = Math.max(score, GOOD_NAME_HINTS.length - i);
  });
  if (BAD_NAME_HINTS.some((b) => name.includes(b))) score -= 5;
  // Cloud/streamed voices (the natural ones) report localService === false.
  if (v.localService === false) score += 3;
  return score;
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return null;

  // 1) Honor the preferred voice (Christopher) if this browser has it.
  for (const hint of PREFERRED_VOICE_HINTS) {
    const match = all.find(
      (v) =>
        v.name.toLowerCase().includes(hint) ||
        v.voiceURI.toLowerCase().includes(hint),
    );
    if (match) return match;
  }

  // 2) Otherwise pick the most natural English voice available.
  const english = all.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length ? english : all;
  return pool.reduce((best, v) =>
    scoreVoice(v) > scoreVoice(best) ? v : best,
  );
}

// Resolve (and cache) the best voice. getVoices() is often empty until the
// browser fires `voiceschanged`, so we listen once and refresh the cache.
function ensureBestVoice(): SpeechSynthesisVoice | null {
  const picked = pickBestVoice();
  if (picked) cachedVoice = picked;
  if (!cachedVoice && !listeningForVoices) {
    listeningForVoices = true;
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoice = pickBestVoice();
    });
  }
  return cachedVoice;
}

// Placeholder implementation: the free browser voice (Web Speech API), upgraded
// to the most natural voice available. No network of our own, no keys. All
// `window.speechSynthesis` access is contained in this module.
const browserSpeaker: Speaker = {
  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  speak(text, handlers = {}) {
    if (!this.isSupported()) {
      handlers.onError?.();
      return;
    }
    // Stop anything already queued/speaking so play is predictable.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = ensureBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95; // a touch slower reads more naturally
    utterance.pitch = 1;
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = () => handlers.onEnd?.();
    utterance.onerror = () => handlers.onError?.();
    window.speechSynthesis.speak(utterance);
  },

  cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // cancel() does not reliably fire onend, so callers should manage their
      // own "stopped" state when they invoke cancel().
      window.speechSynthesis.cancel();
    }
  },
};

// Swap THIS line to change the voice provider for the whole app.
export const speaker: Speaker = browserSpeaker;

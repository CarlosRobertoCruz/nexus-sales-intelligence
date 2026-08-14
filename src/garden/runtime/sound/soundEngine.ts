const SOUND_PATHS: Record<string, string> = {
  message: String(import.meta.env.VITE_SOUND_MESSAGE ?? ""),
  conversation: String(import.meta.env.VITE_SOUND_CONVERSATION ?? ""),
  abandon: String(import.meta.env.VITE_SOUND_ABANDON ?? ""),
  internal: String(import.meta.env.VITE_SOUND_INTERNAL ?? ""),
};

export type SoundId = keyof typeof SOUND_PATHS;

const COOLDOWN = 300;

const lastPlayedMap: Record<SoundId, number> = {
  message: 0,
  conversation: 0,
  abandon: 0,
  internal: 0,
};

const audioCache: Partial<Record<SoundId, HTMLAudioElement>> = {};

let volume = 1;

function warnSoundDev(
  message: string,
  context: Record<string, unknown>
): void {
  if (import.meta.env.DEV) {
    console.warn(`[sound] ${message}`, context);
  }
}

function getAudio(type: SoundId): HTMLAudioElement | null {
  const path = SOUND_PATHS[type];
  if (!path) return null;
  if (!audioCache[type]) {
    try {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = volume;
      audioCache[type] = audio;
    } catch (cause) {
      warnSoundDev("sound-audio-create-failed", { type, path, cause });
      return null;
    }
  }
  return audioCache[type] ?? null;
}

function playSound(type: SoundId): void {
  const now = Date.now();
  const last = lastPlayedMap[type];

  if (now - last < COOLDOWN) return;

  const audio = getAudio(type);
  if (!audio) return;

  lastPlayedMap[type] = now;

  try {
    if (!audio.paused) {
      try {
        audio.pause();
      } catch (_error) {
        void _error;
      }
    }

    try {
      audio.currentTime = 0;
    } catch (_error) {
      void _error;
    }

    const p = audio.play();

    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        warnSoundDev("sound-play-blocked", { type, err });
      });
    }
  } catch (err) {
    warnSoundDev("sound-play-failed", { type, err });
  }
}

export const SoundEngine = {
  play: playSound,

  setVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));

    Object.values(audioCache).forEach((audio) => {
      if (audio) {
        audio.volume = volume;
      }
    });
  },
};

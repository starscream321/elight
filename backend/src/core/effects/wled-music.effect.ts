import { WledLikeAudioData } from './wled-audio.utils';

export interface LedPixel {
  r: number;
  g: number;
  b: number;
}

export interface EffectOptions {
  ledCount: number;
  smoothing: number;
  peakMultiplier: number;
  minPeakVolume: number;
  peakFlashDecay: number;
}

interface ZoneColor {
  start: LedPixel;
  end: LedPixel;
}

const BASS_ZONE_END = 0.3;
const MIDS_ZONE_END = 0.7;

const BASS_COLOR: ZoneColor = {
  start: { r: 42, g: 28, b: 255 },
  end: { r: 160, g: 48, b: 255 },
};
const MIDS_COLOR: ZoneColor = {
  start: { r: 16, g: 255, b: 118 },
  end: { r: 20, g: 220, b: 255 },
};
const HIGHS_COLOR: ZoneColor = {
  start: { r: 255, g: 58, b: 22 },
  end: { r: 255, g: 164, b: 34 },
};

export function renderWledMusicEffect(
  audio: WledLikeAudioData,
  previousPixels: LedPixel[],
  options: EffectOptions,
): LedPixel[] {
  const ledCount = Math.max(0, Math.floor(options.ledCount));
  const fade = clamp(options.smoothing, 0, 0.98);
  const volumeBrightness = 0.18 + (audio.volumeSmth / 255) * 0.82;
  const peakFlash = audio.samplePeak
    ? clamp(options.peakFlashDecay, 0, 1)
    : 0;

  return Array.from({ length: ledCount }, (_, index) => {
    const x = ledCount <= 1 ? 0 : index / (ledCount - 1);
    const zone = getZone(x, audio);
    const localX = getZoneLocalX(x);
    const baseColor = mixPixel(zone.color.start, zone.color.end, localX);

    const fftBand = getBandAtPosition(audio.fftResult, x);
    const bandAccent = 0.72 + (fftBand / 255) * 0.28;
    const intensity =
      Math.pow(zone.energy / 255, 0.82) * volumeBrightness * bandAccent;

    const target = scalePixel(baseColor, intensity);
    const previous = previousPixels[index] ?? { r: 0, g: 0, b: 0 };
    const fadedPrevious = scalePixel(previous, fade);
    const withDecay = maxPixel(target, fadedPrevious);

    return peakFlash > 0
      ? mixPixel(withDecay, { r: 255, g: 255, b: 255 }, peakFlash)
      : withDecay;
  });
}

function getZone(
  x: number,
  audio: WledLikeAudioData,
): { energy: number; color: ZoneColor } {
  if (x < BASS_ZONE_END) {
    return { energy: audio.bass, color: BASS_COLOR };
  }

  if (x < MIDS_ZONE_END) {
    return { energy: audio.mids, color: MIDS_COLOR };
  }

  return { energy: audio.highs, color: HIGHS_COLOR };
}

function getZoneLocalX(x: number): number {
  if (x < BASS_ZONE_END) return x / BASS_ZONE_END;
  if (x < MIDS_ZONE_END) return (x - BASS_ZONE_END) / 0.4;
  return (x - MIDS_ZONE_END) / 0.3;
}

function getBandAtPosition(fftResult: Uint8Array, x: number): number {
  if (fftResult.length === 0) return 0;

  const band = Math.min(
    fftResult.length - 1,
    Math.max(0, Math.floor(x * fftResult.length)),
  );
  return fftResult[band] ?? 0;
}

function mixPixel(a: LedPixel, b: LedPixel, amount: number): LedPixel {
  const t = clamp(amount, 0, 1);
  return {
    r: clampByte(a.r + (b.r - a.r) * t),
    g: clampByte(a.g + (b.g - a.g) * t),
    b: clampByte(a.b + (b.b - a.b) * t),
  };
}

function scalePixel(pixel: LedPixel, scale: number): LedPixel {
  return {
    r: clampByte(pixel.r * scale),
    g: clampByte(pixel.g * scale),
    b: clampByte(pixel.b * scale),
  };
}

function maxPixel(a: LedPixel, b: LedPixel): LedPixel {
  return {
    r: Math.max(a.r, b.r),
    g: Math.max(a.g, b.g),
    b: Math.max(a.b, b.b),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

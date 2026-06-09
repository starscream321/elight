export interface WledLikeAudioData {
  volumeRaw: number;
  volumeSmth: number;
  fftResult: Uint8Array;
  samplePeak: boolean;
  bass: number;
  mids: number;
  highs: number;
}

export interface PeakDetectionOptions {
  peakMultiplier: number;
  minPeakVolume: number;
  cooldownFrames: number;
}

export interface PeakDetectionState {
  cooldownFrames: number;
}

const WLED_FFT_BANDS = 16;
const MIN_MUSIC_HZ = 45;

export function createEmptyWledLikeAudioData(
  volumeSmth = 0,
): WledLikeAudioData {
  return {
    volumeRaw: 0,
    volumeSmth,
    fftResult: new Uint8Array(WLED_FFT_BANDS),
    samplePeak: false,
    bass: 0,
    mids: 0,
    highs: 0,
  };
}

export function calculateVolumeRaw(timeDomainData: Uint8Array): number {
  if (timeDomainData.length === 0) return 0;

  let sumSquares = 0;
  for (const sample of timeDomainData) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / timeDomainData.length);
  return clampByte(Math.round(rms * 255));
}

export function calculateVolumeRawFromFloatSamples(
  samples: ArrayLike<number>,
): number {
  if (samples.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = Number.isFinite(samples[i]) ? samples[i] : 0;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  return clampByte(Math.round(rms * 255));
}

export function detectPeak(
  volumeRaw: number,
  volumeSmth: number,
  state: PeakDetectionState,
  options: PeakDetectionOptions,
): { samplePeak: boolean; cooldownFrames: number } {
  const nextCooldown = Math.max(0, state.cooldownFrames - 1);
  const samplePeak =
    state.cooldownFrames <= 0 &&
    volumeRaw > volumeSmth * options.peakMultiplier &&
    volumeRaw > options.minPeakVolume;

  return {
    samplePeak,
    cooldownFrames: samplePeak
      ? Math.max(0, Math.floor(options.cooldownFrames))
      : nextCooldown,
  };
}

export function mapFrequencyBinsTo16Bands(
  frequencyData: Uint8Array,
  sampleRate: number,
): Uint8Array {
  const bands = new Uint8Array(WLED_FFT_BANDS);
  if (frequencyData.length === 0 || sampleRate <= 0) return bands;

  const nyquist = sampleRate / 2;
  const binHz = nyquist / frequencyData.length;
  const maxHz = Math.max(MIN_MUSIC_HZ + 1, Math.min(nyquist, 12000));

  for (let band = 0; band < WLED_FFT_BANDS; band++) {
    // Logarithmic bands keep more resolution in lows, where musical energy is
    // usually denser, while still reserving upper bands for mids and highs.
    const fromHz =
      MIN_MUSIC_HZ * Math.pow(maxHz / MIN_MUSIC_HZ, band / WLED_FFT_BANDS);
    const toHz =
      MIN_MUSIC_HZ *
      Math.pow(maxHz / MIN_MUSIC_HZ, (band + 1) / WLED_FFT_BANDS);
    const start = Math.max(0, Math.floor(fromHz / binHz));
    const end = Math.min(frequencyData.length - 1, Math.ceil(toHz / binHz));

    let sumSquares = 0;
    let count = 0;
    for (let bin = start; bin <= end; bin++) {
      const value = frequencyData[bin] ?? 0;
      sumSquares += value * value;
      count++;
    }

    bands[band] =
      count > 0 ? clampByte(Math.round(Math.sqrt(sumSquares / count))) : 0;
  }

  return bands;
}

export function averageByteRange(
  values: Uint8Array,
  startInclusive: number,
  endExclusive: number,
): number {
  const start = Math.max(0, Math.min(values.length, startInclusive));
  const end = Math.max(start, Math.min(values.length, endExclusive));
  if (start === end) return 0;

  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += values[i] ?? 0;
  }

  return clampByte(Math.round(sum / (end - start)));
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, value));
}

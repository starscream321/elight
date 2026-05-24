import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChildProcessWithoutNullStreams,
  spawn,
  spawnSync,
} from 'child_process';
import { fft as FFT } from 'fft-js';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 1024;
const DEFAULT_CHANNELS = 2;
const AUTO_DEVICE_VALUE = 'auto';
const LEGACY_WINDOWS_AUDIO_DEVICE = 'CABLE Output (VB-Audio Virtual Cable)';
const DEFAULT_AUTO_MIN_RMS = 0.002;
const DEFAULT_DEBUG_INTERVAL_MS = 1000;
const DEFAULT_NOISE_FLOOR_RMS = 0.006;
const DEFAULT_PULSE_LATENCY_MS = 20;
const DEFAULT_ALSA_PERIOD_MS = 10;
const DEFAULT_ALSA_BUFFER_MS = 30;
const DEFAULT_NORMALIZE_TARGET_RMS = 0.06;
const DEFAULT_NORMALIZE_TARGET_PEAK = 0.35;
const DEFAULT_NORMALIZE_MIN_GAIN = 0.05;
const DEFAULT_NORMALIZE_MAX_GAIN = 7;
const GAIN_DECREASE_RATE = 0.82;
const GAIN_INCREASE_RATE = 0.1;
const MAX_GAIN_OVERSHOOT = 1.35;
const CLIP_WARNING_LEVEL = 0.95;
const BAND_NORMALIZE_BOOST = 3.8;
const BAND_FEATURE_CEILING = 0.88;
const BAND_FLOOR_RISE_RATE = 0.003;
const BAND_FLOOR_FALL_RATE = 0.08;
const BAND_CEILING_RISE_RATE = 0.16;
const BAND_CEILING_FALL_RATE = 0.006;
const INPUT_SAFETY_RISE_RATE = 0.18;
const INPUT_SAFETY_FALL_RATE = 0.55;
const DIRTY_SIGNAL_FLATNESS_START = 0.42;
const DIRTY_SIGNAL_FLATNESS_FULL = 0.78;
const LOW_CREST_RMS_THRESHOLD = 0.08;
const LOW_CREST_START = 2.2;
const LOW_CREST_FULL = 1.45;
const ENVELOPE_BEAT_THRESHOLD = 0.04;
const ENVELOPE_BEAT_RATIO = 1.7;
const ENVELOPE_BEAT_COOLDOWN_SAMPLES = Math.round(SAMPLE_RATE * 0.12);

const BAND_SETTINGS = {
  kick: {
    fromHz: 45,
    toHz: 125,
    centerHz: 78,
    ratioThreshold: 1.1,
    exponent: 1.1,
    rise: 0.62,
    fall: 0.18,
  },
  bass: {
    fromHz: 125,
    toHz: 320,
    centerHz: 190,
    ratioThreshold: 1.14,
    exponent: 1.2,
    rise: 0.5,
    fall: 0.16,
  },
  mid: {
    fromHz: 320,
    toHz: 2200,
    centerHz: 850,
    ratioThreshold: 1.28,
    exponent: 1.45,
    rise: 0.32,
    fall: 0.11,
  },
  treble: {
    fromHz: 2200,
    toHz: 9000,
    centerHz: 4800,
    ratioThreshold: 1.45,
    exponent: 1.55,
    rise: 0.28,
    fall: 0.1,
  },
} as const;

type BandSettings = (typeof BAND_SETTINGS)[keyof typeof BAND_SETTINGS];
type BandKey = keyof typeof BAND_SETTINGS;

export interface AudioFeatures {
  kick: number;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beat: boolean;
}

type AudioSourceKind = 'alsa' | 'pulse';

interface AudioSourceCandidate {
  kind: AudioSourceKind;
  device: string;
  label: string;
}

@Injectable()
export class AudioService implements OnModuleDestroy {
  private readonly logger = new Logger(AudioService.name);

  private readonly audioMono = new Float32Array(FFT_SIZE);
  private readonly windowedAudio = new Array<number>(FFT_SIZE);
  private readonly window = this.hannWindow(FFT_SIZE);

  private audioWriteIndex = 0;
  private audioSamplesSeen = 0;
  private started = false;
  private audioProcess?: ChildProcessWithoutNullStreams;
  private readonly audioChannels: number;
  private readonly debugEnabled: boolean;
  private readonly debugIntervalMs: number;
  private readonly noiseFloorRms: number;
  private readonly pulseLatencyMs: number;
  private readonly alsaPeriodMs: number;
  private readonly alsaBufferMs: number;
  private readonly normalizeTargetRms: number;
  private readonly normalizeTargetPeak: number;
  private readonly normalizeMinGain: number;
  private readonly normalizeMaxGain: number;
  private inputDebugSumSquares = 0;
  private inputDebugPeak = 0;
  private inputDebugSamples = 0;
  private inputDebugClippedSamples = 0;
  private inputRmsSumSquares = 0;
  private inputRmsSamples = 0;
  private inputGain = 1;
  private inputSafety = 1;
  private inputWindowRms = 0;
  private inputWindowPeak = 0;
  private normalizedWindowRms = 0;
  private normalizedWindowPeak = 0;
  private spectralFlatness = 0;
  private lastDebugAt = 0;

  private smoothed = {
    kick: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };

  private bandFloor: Record<BandKey, number> = {
    kick: 1e-3,
    bass: 1e-3,
    mid: 1e-3,
    treble: 1e-3,
  };

  private bandCeiling: Record<BandKey, number> = {
    kick: 0.02,
    bass: 0.02,
    mid: 0.02,
    treble: 0.02,
  };

  private dcBlockX = 0;
  private dcBlockY = 0;
  private beatCooldown = 0;
  private lowEnergyHistoryIndex = 0;
  private lowEnergyHistoryCount = 0;
  private readonly lowEnergyHistory = new Float32Array(64);
  private inputEnvelopeFast = 0;
  private inputEnvelopeSlow = 0;
  private envelopeBeatCooldownSamples = 0;
  private pendingEnvelopeBeat = false;

  constructor(private readonly config: ConfigService) {
    this.audioChannels = this.getAudioChannels();
    this.debugEnabled = this.getBooleanConfig('AUDIO_DEBUG');
    this.debugIntervalMs = this.getDebugIntervalMs();
    this.noiseFloorRms = this.getNoiseFloorRms();
    this.pulseLatencyMs = this.getPositiveConfigInt(
      'AUDIO_PULSE_LATENCY_MS',
      DEFAULT_PULSE_LATENCY_MS,
    );
    this.alsaPeriodMs = this.getPositiveConfigInt(
      'AUDIO_ALSA_PERIOD_MS',
      DEFAULT_ALSA_PERIOD_MS,
    );
    this.alsaBufferMs = Math.max(
      this.alsaPeriodMs * 2,
      this.getPositiveConfigInt('AUDIO_ALSA_BUFFER_MS', DEFAULT_ALSA_BUFFER_MS),
    );
    this.normalizeTargetRms = this.getPositiveConfigNumber(
      'AUDIO_NORMALIZE_TARGET_RMS',
      DEFAULT_NORMALIZE_TARGET_RMS,
    );
    this.normalizeTargetPeak = this.getPositiveConfigNumber(
      'AUDIO_NORMALIZE_TARGET_PEAK',
      DEFAULT_NORMALIZE_TARGET_PEAK,
    );
    this.normalizeMinGain = this.getPositiveConfigNumber(
      'AUDIO_NORMALIZE_MIN_GAIN',
      DEFAULT_NORMALIZE_MIN_GAIN,
    );
    this.normalizeMaxGain = Math.max(
      this.normalizeMinGain,
      this.getPositiveConfigNumber(
        'AUDIO_NORMALIZE_MAX_GAIN',
        DEFAULT_NORMALIZE_MAX_GAIN,
      ),
    );
  }

  onModuleDestroy() {
    this.audioProcess?.kill('SIGTERM');
  }

  getAudioSpectrum(): AudioFeatures {
    this.start();

    if (this.audioSamplesSeen < FFT_SIZE) {
      return this.emptyFeatures();
    }

    const currentInputRms = this.consumeInputRms();
    const windowStats = this.calculateCurrentWindowStats();
    if (windowStats.rms < this.noiseFloorRms) {
      const features = this.emptyFeatures();
      this.resetAudioAnalysisState();
      this.logDebug(features, currentInputRms);
      return features;
    }

    const gain = this.updateInputGain(windowStats.rms, windowStats.peak);
    const desiredGain = this.calculateDesiredInputGain(
      windowStats.rms,
      windowStats.peak,
    );
    const analysisGain = Math.min(gain, desiredGain * MAX_GAIN_OVERSHOOT);
    this.inputGain = analysisGain;
    this.inputWindowRms = windowStats.rms;
    this.inputWindowPeak = windowStats.peak;
    this.normalizedWindowRms = windowStats.rms * analysisGain;
    this.normalizedWindowPeak = windowStats.peak * analysisGain;

    for (let i = 0; i < FFT_SIZE; i++) {
      const sourceIndex = (this.audioWriteIndex + i) % FFT_SIZE;
      const normalizedSample = this.softLimitSample(
        this.audioMono[sourceIndex] * analysisGain,
      );
      this.windowedAudio[i] = normalizedSample * this.window[i];
    }

    const spectrum = FFT(this.windowedAudio);
    const mags = spectrum
      .slice(0, FFT_SIZE / 2)
      .map(([re, im]: [number, number]) => Math.hypot(re, im));

    const binHz = SAMPLE_RATE / FFT_SIZE;
    const safetyTarget = Math.min(
      this.calculateInputShapeSafety(windowStats.rms, windowStats.peak),
      this.calculateSpectralSafety(mags, binHz),
    );
    this.inputSafety = this.smoothValue(
      safetyTarget,
      this.inputSafety,
      INPUT_SAFETY_RISE_RATE,
      INPUT_SAFETY_FALL_RATE,
    );

    const kickRaw = this.weightedBandRms(mags, binHz, BAND_SETTINGS.kick);
    const bassRaw = this.weightedBandRms(mags, binHz, BAND_SETTINGS.bass);
    const midRaw = this.weightedBandRms(mags, binHz, BAND_SETTINGS.mid);
    const trebleRaw = this.weightedBandRms(mags, binHz, BAND_SETTINGS.treble);

    const kickNorm = this.normalizeBand('kick', kickRaw, BAND_SETTINGS.kick);
    const bassNorm = this.normalizeBand('bass', bassRaw, BAND_SETTINGS.bass);
    const midNorm = this.normalizeBand('mid', midRaw, BAND_SETTINGS.mid);
    const trebleNorm = this.normalizeBand(
      'treble',
      trebleRaw,
      BAND_SETTINGS.treble,
    );
    const safeKickNorm = kickNorm * this.inputSafety;
    const safeBassNorm = bassNorm * this.inputSafety;
    const safeMidNorm = midNorm * this.inputSafety;
    const safeTrebleNorm = trebleNorm * this.inputSafety;

    this.smoothed.kick = this.smoothValue(
      safeKickNorm,
      this.smoothed.kick,
      BAND_SETTINGS.kick.rise,
      BAND_SETTINGS.kick.fall,
    );
    this.smoothed.bass = this.smoothValue(
      safeBassNorm,
      this.smoothed.bass,
      BAND_SETTINGS.bass.rise,
      BAND_SETTINGS.bass.fall,
    );
    this.smoothed.mid = this.smoothValue(
      safeMidNorm,
      this.smoothed.mid,
      BAND_SETTINGS.mid.rise,
      BAND_SETTINGS.mid.fall,
    );
    this.smoothed.treble = this.smoothValue(
      safeTrebleNorm,
      this.smoothed.treble,
      BAND_SETTINGS.treble.rise,
      BAND_SETTINGS.treble.fall,
    );

    const energy =
      this.smoothed.kick * 0.5 +
      this.smoothed.bass * 0.3 +
      this.smoothed.mid * 0.15 +
      this.smoothed.treble * 0.05;

    const beat =
      this.inputSafety > 0.45 &&
      (this.detectBeatFromLowEnergy(kickRaw, bassRaw) ||
        this.consumeEnvelopeBeat());

    const features = {
      kick: this.smoothed.kick,
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      treble: this.smoothed.treble,
      energy,
      beat,
    };

    this.logDebug(features, currentInputRms);

    return features;
  }

  private start() {
    if (this.started) return;
    this.started = true;

    const source = this.resolveAudioSource();

    try {
      this.audioProcess = this.spawnAudioSource(source);
      this.audioProcess.stdout.on('data', (buf: Buffer) =>
        this.handleChunk(buf),
      );
      this.audioProcess.stderr.on('data', (buf: Buffer) => {
        this.logger.warn(
          `Audio input warning (${source.label}): ${buf.toString().trim()}`,
        );
      });
      this.audioProcess.on('error', (error) =>
        this.logger.error('Audio input process error', error.stack),
      );
      this.audioProcess.on('exit', (code, signal) => {
        this.logger.warn(
          `Audio input stopped (${source.label}), code=${code}, signal=${signal}`,
        );
        this.started = false;
        this.audioProcess = undefined;
      });

      this.logger.log(`Using audio source: ${source.label}`);
    } catch (error) {
      this.logger.error(
        'Failed to start microphone input',
        (error as Error).stack,
      );
    }
  }

  private resolveAudioSource(): AudioSourceCandidate {
    const configured = this.config.get<string>('AUDIO_DEVICE')?.trim();
    if (
      configured &&
      configured !== AUTO_DEVICE_VALUE &&
      configured !== LEGACY_WINDOWS_AUDIO_DEVICE
    ) {
      return this.parseConfiguredAudioSource(configured);
    }

    const candidates = this.getAutoAudioSources();
    if (candidates.length === 0) {
      this.logger.warn('No audio sources found, falling back to ALSA default');
      return { kind: 'alsa', device: 'default', label: 'ALSA default' };
    }

    const minRms = this.getAutoMinRms();
    let best = { source: candidates[0], rms: 0 };

    for (const source of candidates) {
      const rms = this.measureAudioSource(source);
      this.logger.log(
        `Audio source probe: ${source.label}, rms=${rms.toFixed(5)}`,
      );
      if (rms > best.rms) {
        best = { source, rms };
      }
    }

    if (best.rms < minRms) {
      this.logger.warn(
        `No active audio source exceeded rms=${minRms}; using first available source: ${candidates[0].label}`,
      );
      return candidates[0];
    }

    return best.source;
  }

  private parseConfiguredAudioSource(value: string): AudioSourceCandidate {
    if (value.startsWith('pulse:')) {
      const device = value.slice('pulse:'.length);
      return { kind: 'pulse', device, label: `PulseAudio/PipeWire ${device}` };
    }

    if (value.startsWith('alsa:')) {
      const device = value.slice('alsa:'.length);
      return { kind: 'alsa', device, label: `ALSA ${device}` };
    }

    return { kind: 'alsa', device: value, label: `ALSA ${value}` };
  }

  private getAutoMinRms() {
    const configured = Number(this.config.get('AUDIO_AUTO_MIN_RMS'));
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_AUTO_MIN_RMS;
  }

  private getAutoAudioSources(): AudioSourceCandidate[] {
    const sources = [
      ...this.getPulseMonitorSources(),
      { kind: 'alsa' as const, device: 'default', label: 'ALSA default' },
      ...this.getAlsaCaptureSources(),
    ];

    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = `${source.kind}:${source.device}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getPulseMonitorSources(): AudioSourceCandidate[] {
    const sourceList = this.runTextCommand('pactl', [
      'list',
      'short',
      'sources',
    ]);
    if (!sourceList) return [];

    const defaultSink = this.runTextCommand('pactl', [
      'get-default-sink',
    ])?.trim();
    const monitorNames = sourceList
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[1])
      .filter((name): name is string =>
        Boolean(name && name.includes('.monitor')),
      );

    if (defaultSink) {
      const defaultMonitor = `${defaultSink}.monitor`;
      monitorNames.sort((left, right) => {
        if (left === defaultMonitor) return -1;
        if (right === defaultMonitor) return 1;
        return 0;
      });
    }

    return monitorNames.map((device) => ({
      kind: 'pulse',
      device,
      label: `PulseAudio/PipeWire monitor ${device}`,
    }));
  }

  private getAlsaCaptureSources(): AudioSourceCandidate[] {
    const output = this.runTextCommand('arecord', ['-l']);
    if (!output) return [];

    const sources: AudioSourceCandidate[] = [];
    const cardDevicePattern =
      /card\s+(\d+):\s*([^,]+).*device\s+(\d+):\s*([^[]+)/i;

    for (const line of output.split(/\r?\n/)) {
      const match = line.match(cardDevicePattern);
      if (!match) continue;

      const [, card, cardName, device, deviceName] = match;
      sources.push({
        kind: 'alsa',
        device: `plughw:${card},${device}`,
        label: `ALSA ${cardName.trim()} ${deviceName.trim()} (plughw:${card},${device})`,
      });
    }

    return sources;
  }

  private measureAudioSource(source: AudioSourceCandidate): number {
    const { command, args } = this.buildProbeCommand(source);
    const result = spawnSync(command, args, {
      timeout: 1500,
      maxBuffer: SAMPLE_RATE * this.audioChannels * 2 * 2,
    });

    if (
      result.error &&
      result.error.message !== 'spawnSync parecord ETIMEDOUT'
    ) {
      this.logger.debug(
        `Failed to probe ${source.label}: ${result.error.message}`,
      );
    }

    return this.calculateRms(result.stdout);
  }

  private buildProbeCommand(source: AudioSourceCandidate) {
    if (source.kind === 'pulse') {
      return {
        command: 'parecord',
        args: [
          '--raw',
          '--format=s16le',
          `--rate=${SAMPLE_RATE}`,
          `--channels=${this.audioChannels}`,
          `--latency-msec=${this.pulseLatencyMs}`,
          `--device=${source.device}`,
        ],
      };
    }

    return {
      command: 'arecord',
      args: [
        '-q',
        '-D',
        source.device,
        '-f',
        'S16_LE',
        '-r',
        String(SAMPLE_RATE),
        '-c',
        String(this.audioChannels),
        '-t',
        'raw',
        `--period-time=${this.alsaPeriodMs * 1000}`,
        `--buffer-time=${this.alsaBufferMs * 1000}`,
        '-d',
        '1',
      ],
    };
  }

  private spawnAudioSource(
    source: AudioSourceCandidate,
  ): ChildProcessWithoutNullStreams {
    if (source.kind === 'pulse') {
      return spawn('parecord', [
        '--raw',
        '--format=s16le',
        `--rate=${SAMPLE_RATE}`,
        `--channels=${this.audioChannels}`,
        `--latency-msec=${this.pulseLatencyMs}`,
        `--device=${source.device}`,
      ]);
    }

    return spawn('arecord', [
      '-q',
      '-D',
      source.device,
      '-f',
      'S16_LE',
      '-r',
      String(SAMPLE_RATE),
      '-c',
      String(this.audioChannels),
      '-t',
      'raw',
      `--period-time=${this.alsaPeriodMs * 1000}`,
      `--buffer-time=${this.alsaBufferMs * 1000}`,
    ]);
  }

  private runTextCommand(command: string, args: string[]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.error || result.status !== 0) return null;
    return result.stdout;
  }

  private calculateRms(buf: Buffer) {
    const sampleCount = Math.floor(buf.length / 2);
    if (sampleCount === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const sample = buf.readInt16LE(i * 2) / 32768;
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }

  private getAudioChannels() {
    const configured = Number(this.config.get('AUDIO_CHANNELS'));
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_CHANNELS;
  }

  private getDebugIntervalMs() {
    const configured = Number(this.config.get('AUDIO_DEBUG_INTERVAL_MS'));
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_DEBUG_INTERVAL_MS;
  }

  private getNoiseFloorRms() {
    const configured = Number(this.config.get('AUDIO_NOISE_FLOOR_RMS'));
    return Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_NOISE_FLOOR_RMS;
  }

  private getPositiveConfigInt(key: string, fallback: number) {
    const configured = Number(this.config.get(key));
    return Number.isInteger(configured) && configured > 0
      ? configured
      : fallback;
  }

  private getPositiveConfigNumber(key: string, fallback: number) {
    const configured = Number(this.config.get(key));
    return Number.isFinite(configured) && configured > 0
      ? configured
      : fallback;
  }

  private getBooleanConfig(key: string) {
    const value = this.config.get<string | boolean>(key);
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }

  private handleChunk(buf: Buffer) {
    const { type, data } = this.parseChunk(buf);
    if (!data) return;

    const mono = this.toMono(data, this.audioChannels, type);
    for (let i = 0; i < mono.length; i++) {
      const sample = this.conditionInputSample(mono[i]);
      this.detectEnvelopeBeat(sample);
      this.collectInputRms(sample);
      this.collectInputDebug(sample);
      this.audioMono[this.audioWriteIndex] = sample;
      this.audioWriteIndex = (this.audioWriteIndex + 1) % FFT_SIZE;
    }
    this.audioSamplesSeen += mono.length;
  }

  private parseChunk(
    buf: Buffer,
  ):
    | { type: 'int16'; data: Int16Array }
    | { type: 'f32'; data: Float32Array }
    | { type: 'unknown'; data: null } {
    if (buf.length % 2 === 0) {
      return {
        type: 'int16',
        data: new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2),
      };
    }

    if (buf.length % 4 === 0) {
      return {
        type: 'f32',
        data: new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4),
      };
    }

    return { type: 'unknown', data: null };
  }

  private toMono(
    arr: Int16Array | Float32Array,
    channels: number,
    type: 'int16' | 'f32',
  ) {
    const nFrames = Math.floor(arr.length / channels);
    const out = new Float32Array(nFrames);
    const scale = type === 'int16' ? 1 / 32768 : 1;

    for (let i = 0, j = 0; j < nFrames; i += channels, j++) {
      let frameSum = 0;
      for (let channel = 0; channel < channels; channel++) {
        frameSum += Number(arr[i + channel]);
      }

      const v = (frameSum / channels) * scale;
      out[j] = Number.isFinite(v) ? v : 0;
    }

    return out;
  }

  private hannWindow(size: number) {
    const out = new Array<number>(size);
    for (let n = 0; n < size; n++) {
      out[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
    }
    return out;
  }

  private smoothValue(curr: number, prev: number, rise = 0.25, fall = 0.1) {
    return prev + (curr - prev) * (curr > prev ? rise : fall);
  }

  private calculateCurrentWindowStats() {
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < FFT_SIZE; i++) {
      const sourceIndex = (this.audioWriteIndex + i) % FFT_SIZE;
      const sample = this.audioMono[sourceIndex];
      peak = Math.max(peak, Math.abs(sample));
      sumSquares += sample * sample;
    }

    return {
      rms: Math.sqrt(sumSquares / FFT_SIZE),
      peak,
    };
  }

  private updateInputGain(windowRms: number, windowPeak = windowRms) {
    if (!Number.isFinite(windowRms) || windowRms <= this.noiseFloorRms) {
      this.inputGain = this.smoothValue(1, this.inputGain, 0.08, 0.08);
      return this.inputGain;
    }

    const desiredGain = this.calculateDesiredInputGain(windowRms, windowPeak);
    if (desiredGain < this.inputGain) {
      const smoothedGain =
        this.inputGain + (desiredGain - this.inputGain) * GAIN_DECREASE_RATE;
      this.inputGain = Math.min(smoothedGain, desiredGain * MAX_GAIN_OVERSHOOT);
      return this.inputGain;
    }

    this.inputGain += (desiredGain - this.inputGain) * GAIN_INCREASE_RATE;
    return this.inputGain;
  }

  private calculateDesiredInputGain(windowRms: number, windowPeak = windowRms) {
    const desiredRmsGain =
      this.normalizeTargetRms / Math.max(windowRms, this.noiseFloorRms);
    const desiredPeakGain =
      Number.isFinite(windowPeak) && windowPeak > this.noiseFloorRms
        ? this.normalizeTargetPeak / windowPeak
        : this.normalizeMaxGain;

    return this.clamp(
      Math.min(desiredRmsGain, desiredPeakGain),
      this.normalizeMinGain,
      this.normalizeMaxGain,
    );
  }

  private calculateInputShapeSafety(windowRms: number, windowPeak: number) {
    if (!Number.isFinite(windowRms) || windowRms <= this.noiseFloorRms) {
      return 1;
    }

    const peakSafety = 1 - this.smoothstep(0.82, 0.98, windowPeak);
    const crest = windowPeak / Math.max(windowRms, 1e-6);
    const crestPenalty =
      windowRms > LOW_CREST_RMS_THRESHOLD
        ? this.smoothstep(LOW_CREST_START, LOW_CREST_FULL, crest)
        : 0;

    return this.clamp(Math.min(peakSafety, 1 - crestPenalty * 0.78), 0.18, 1);
  }

  private calculateSpectralSafety(mags: number[], binHz: number) {
    const start = Math.max(1, Math.floor(45 / binHz));
    const end = Math.min(mags.length - 1, Math.ceil(9000 / binHz));
    let logSum = 0;
    let linearSum = 0;
    let count = 0;

    for (let i = start; i <= end; i++) {
      const value = mags[i];
      if (!Number.isFinite(value) || value <= 0) continue;

      logSum += Math.log(value + 1e-9);
      linearSum += value;
      count++;
    }

    if (count === 0 || linearSum <= 0) {
      this.spectralFlatness = 0;
      return 1;
    }

    const geometricMean = Math.exp(logSum / count);
    const arithmeticMean = linearSum / count;
    const flatness = this.clamp(geometricMean / arithmeticMean, 0, 1);
    this.spectralFlatness = flatness;

    const dirtyAmount = this.smoothstep(
      DIRTY_SIGNAL_FLATNESS_START,
      DIRTY_SIGNAL_FLATNESS_FULL,
      flatness,
    );

    return this.clamp(1 - dirtyAmount * 0.72, 0.28, 1);
  }

  private smoothstep(edge0: number, edge1: number, value: number) {
    if (edge0 === edge1) return value >= edge1 ? 1 : 0;

    const t = this.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  private softLimitSample(sample: number) {
    if (!Number.isFinite(sample)) return 0;
    return Math.tanh(sample);
  }

  private weightedBandRms(mags: number[], binHz: number, band: BandSettings) {
    const start = Math.max(1, Math.floor(band.fromHz / binHz));
    const end = Math.min(mags.length - 1, Math.ceil(band.toHz / binHz));
    let weightedPower = 0;
    let weightSum = 0;

    for (let i = start; i <= end; i++) {
      const value = mags[i];
      if (!Number.isFinite(value)) continue;

      const hz = Math.max(binHz, i * binHz);
      const octaveDistance = Math.abs(Math.log2(hz / band.centerHz));
      const focus =
        0.35 + 0.65 * Math.exp(-0.5 * Math.pow(octaveDistance / 0.85, 2));

      weightedPower += value * value * focus;
      weightSum += focus;
    }

    return weightSum > 0 ? Math.sqrt(weightedPower / weightSum) : 0;
  }

  private shapeBand(value: number, exponent: number) {
    return Math.pow(this.clamp(value, 0, 1), exponent);
  }

  private normalizeBand(key: BandKey, raw: number, band: BandSettings) {
    if (!Number.isFinite(raw) || raw <= 0) return 0;

    const currentFloor = this.bandFloor[key];
    const floorRate =
      raw < currentFloor ? BAND_FLOOR_FALL_RATE : BAND_FLOOR_RISE_RATE;
    const floor = currentFloor + (raw - currentFloor) * floorRate;

    const currentCeiling = Math.max(this.bandCeiling[key], floor + 1e-4);
    const ceilingTarget = Math.max(raw, floor * 1.35 + 1e-4);
    const ceilingRate =
      ceilingTarget > currentCeiling
        ? BAND_CEILING_RISE_RATE
        : BAND_CEILING_FALL_RATE;
    const ceiling =
      currentCeiling + (ceilingTarget - currentCeiling) * ceilingRate;

    this.bandFloor[key] = floor;
    this.bandCeiling[key] = Math.max(ceiling, floor + 1e-4);

    const range = Math.max(this.bandCeiling[key] - floor, 1e-4);
    const normalized = this.clamp((raw - floor) / range, 0, 1.4);
    const compressed =
      Math.log1p(normalized * BAND_NORMALIZE_BOOST) /
      Math.log1p(BAND_NORMALIZE_BOOST);

    return Math.min(
      BAND_FEATURE_CEILING,
      this.shapeBand(compressed, band.exponent),
    );
  }

  private conditionInputSample(sample: number) {
    const clipped = this.clamp(sample, -0.98, 0.98);
    const filtered = clipped - this.dcBlockX + 0.995 * this.dcBlockY;

    this.dcBlockX = clipped;
    this.dcBlockY = filtered;

    return this.clamp(filtered, -1, 1);
  }

  private collectInputDebug(sample: number) {
    if (!this.debugEnabled) return;

    const abs = Math.abs(sample);
    this.inputDebugPeak = Math.max(this.inputDebugPeak, abs);
    if (abs >= CLIP_WARNING_LEVEL) {
      this.inputDebugClippedSamples++;
    }
    this.inputDebugSumSquares += sample * sample;
    this.inputDebugSamples++;
  }

  private collectInputRms(sample: number) {
    this.inputRmsSumSquares += sample * sample;
    this.inputRmsSamples++;
  }

  private consumeInputRms() {
    if (this.inputRmsSamples === 0) return 0;

    const rms = Math.sqrt(this.inputRmsSumSquares / this.inputRmsSamples);
    this.inputRmsSumSquares = 0;
    this.inputRmsSamples = 0;
    return rms;
  }

  private detectEnvelopeBeat(sample: number) {
    const level = Math.abs(sample);

    this.inputEnvelopeFast += (level - this.inputEnvelopeFast) * 0.18;
    this.inputEnvelopeSlow += (level - this.inputEnvelopeSlow) * 0.012;

    if (this.envelopeBeatCooldownSamples > 0) {
      this.envelopeBeatCooldownSamples--;
      return;
    }

    const ratio = this.inputEnvelopeFast / (this.inputEnvelopeSlow + 1e-4);
    if (
      this.inputEnvelopeFast > ENVELOPE_BEAT_THRESHOLD &&
      ratio > ENVELOPE_BEAT_RATIO
    ) {
      this.pendingEnvelopeBeat = true;
      this.envelopeBeatCooldownSamples = ENVELOPE_BEAT_COOLDOWN_SAMPLES;
    }
  }

  private consumeEnvelopeBeat() {
    const beat = this.pendingEnvelopeBeat;
    this.pendingEnvelopeBeat = false;
    return beat;
  }

  private logDebug(features: AudioFeatures, inputRms?: number) {
    if (!this.debugEnabled) return;

    const now = Date.now();
    if (now - this.lastDebugAt < this.debugIntervalMs) return;
    this.lastDebugAt = now;

    const debugInputRms =
      inputRms ??
      (this.inputDebugSamples > 0
        ? Math.sqrt(this.inputDebugSumSquares / this.inputDebugSamples)
        : 0);

    this.logger.log(
      [
        'Audio debug',
        `inRms=${debugInputRms.toFixed(4)}`,
        `winRms=${this.inputWindowRms.toFixed(4)}`,
        `winPeak=${this.inputWindowPeak.toFixed(4)}`,
        `normRms=${this.normalizedWindowRms.toFixed(4)}`,
        `normPeak=${this.normalizedWindowPeak.toFixed(4)}`,
        `gain=${this.inputGain.toFixed(2)}`,
        `safety=${this.inputSafety.toFixed(2)}`,
        `flatness=${this.spectralFlatness.toFixed(2)}`,
        `inPeak=${this.inputDebugPeak.toFixed(4)}`,
        `clip=${this.getInputClipPercent().toFixed(1)}%`,
        `noiseFloor=${this.noiseFloorRms.toFixed(4)}`,
        `kick=${features.kick.toFixed(3)}`,
        `bass=${features.bass.toFixed(3)}`,
        `mid=${features.mid.toFixed(3)}`,
        `treble=${features.treble.toFixed(3)}`,
        `energy=${features.energy.toFixed(3)}`,
        `beat=${features.beat ? 'yes' : 'no'}`,
      ].join(' | '),
    );

    this.inputDebugSumSquares = 0;
    this.inputDebugPeak = 0;
    this.inputDebugSamples = 0;
    this.inputDebugClippedSamples = 0;
  }

  private getInputClipPercent() {
    if (this.inputDebugSamples === 0) return 0;
    return (this.inputDebugClippedSamples / this.inputDebugSamples) * 100;
  }

  private resetAudioAnalysisState() {
    this.smoothed.kick = this.smoothValue(0, this.smoothed.kick, 0.2, 0.2);
    this.smoothed.bass = this.smoothValue(0, this.smoothed.bass, 0.2, 0.2);
    this.smoothed.mid = this.smoothValue(0, this.smoothed.mid, 0.2, 0.2);
    this.smoothed.treble = this.smoothValue(0, this.smoothed.treble, 0.2, 0.2);
    this.relaxBandRanges();
    this.pendingEnvelopeBeat = false;
    this.inputEnvelopeFast = 0;
    this.inputEnvelopeSlow = 0;
    this.inputGain = this.smoothValue(1, this.inputGain, 0.08, 0.08);
    this.inputSafety = this.smoothValue(1, this.inputSafety, 0.08, 0.08);
    this.inputWindowRms = 0;
    this.inputWindowPeak = 0;
    this.normalizedWindowRms = 0;
    this.normalizedWindowPeak = 0;
    this.spectralFlatness = 0;
  }

  private relaxBandRanges() {
    for (const key of Object.keys(this.bandFloor) as BandKey[]) {
      this.bandFloor[key] = this.smoothValue(
        1e-3,
        this.bandFloor[key],
        0.08,
        0.08,
      );
      this.bandCeiling[key] = this.smoothValue(
        0.02,
        this.bandCeiling[key],
        0.04,
        0.04,
      );
    }
  }

  private detectBeatFromLowEnergy(kickRaw: number, bassRaw: number) {
    const lowEnergy = kickRaw * 0.72 + bassRaw * 0.28;
    const stats = this.getLowEnergyStats();

    this.pushLowEnergy(lowEnergy);

    if (this.beatCooldown > 0) this.beatCooldown--;
    if (this.lowEnergyHistoryCount < 24) return false;

    const dynamicFloor = stats.mean + stats.stdDev * 0.7 + 1e-6;
    const transient = lowEnergy - stats.mean;
    const ratio = lowEnergy / dynamicFloor;

    const beat =
      transient > stats.stdDev * 1.75 &&
      ratio > 1.35 &&
      this.beatCooldown === 0;
    if (beat) this.beatCooldown = 9;

    return beat;
  }

  private getLowEnergyStats() {
    const count = this.lowEnergyHistoryCount;
    if (count === 0) return { mean: 0, stdDev: 0 };

    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += this.lowEnergyHistory[i];
    }

    const mean = sum / count;
    let variance = 0;
    for (let i = 0; i < count; i++) {
      const diff = this.lowEnergyHistory[i] - mean;
      variance += diff * diff;
    }

    return { mean, stdDev: Math.sqrt(variance / count) };
  }

  private pushLowEnergy(value: number) {
    this.lowEnergyHistory[this.lowEnergyHistoryIndex] = value;
    this.lowEnergyHistoryIndex =
      (this.lowEnergyHistoryIndex + 1) % this.lowEnergyHistory.length;
    this.lowEnergyHistoryCount = Math.min(
      this.lowEnergyHistoryCount + 1,
      this.lowEnergyHistory.length,
    );
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private emptyFeatures(): AudioFeatures {
    return { kick: 0, bass: 0, mid: 0, treble: 0, energy: 0, beat: false };
  }
}

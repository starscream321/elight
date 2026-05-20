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

  private smoothed = {
    kick: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };

  private peak = {
    kick: 1e-3,
    bass: 1e-3,
    mid: 1e-3,
    treble: 1e-3,
  };

  private dcBlockX = 0;
  private dcBlockY = 0;
  private beatCooldown = 0;
  private lowEnergyHistoryIndex = 0;
  private lowEnergyHistoryCount = 0;
  private readonly lowEnergyHistory = new Float32Array(48);

  constructor(private readonly config: ConfigService) {
    this.audioChannels = this.getAudioChannels();
  }

  onModuleDestroy() {
    this.audioProcess?.kill('SIGTERM');
  }

  getAudioSpectrum(): AudioFeatures {
    this.start();

    if (this.audioSamplesSeen < FFT_SIZE) {
      return this.emptyFeatures();
    }

    for (let i = 0; i < FFT_SIZE; i++) {
      const sourceIndex = (this.audioWriteIndex + i) % FFT_SIZE;
      this.windowedAudio[i] = this.audioMono[sourceIndex] * this.window[i];
    }

    const spectrum = FFT(this.windowedAudio);
    const mags = spectrum
      .slice(0, FFT_SIZE / 2)
      .map(([re, im]: [number, number]) => Math.hypot(re, im));

    const bin = SAMPLE_RATE / FFT_SIZE;
    const idx = (hz: number) => Math.min(mags.length - 1, Math.round(hz / bin));

    const kickRaw = this.safeAvgRange(mags, idx(60), idx(150));
    const bassRaw = this.safeAvgRange(mags, idx(150), idx(300));
    const midRaw = this.safeAvgRange(mags, idx(300), idx(2000));
    const trebleRaw = this.safeAvgRange(mags, idx(2000), idx(6000));

    this.peak.kick = Math.max(this.peak.kick * 0.995, kickRaw);
    this.peak.bass = Math.max(this.peak.bass * 0.995, bassRaw);
    this.peak.mid = Math.max(this.peak.mid * 0.995, midRaw);
    this.peak.treble = Math.max(this.peak.treble * 0.995, trebleRaw);

    const kickNorm = this.noiseGate(kickRaw / this.peak.kick, 0.035);
    const bassNorm = this.noiseGate(bassRaw / this.peak.bass, 0.045);
    const midNorm = this.noiseGate(midRaw / this.peak.mid, 0.04);
    const trebleNorm = this.noiseGate(trebleRaw / this.peak.treble, 0.03);

    this.smoothed.kick = this.smoothValue(
      kickNorm,
      this.smoothed.kick,
      0.45,
      0.2,
    );
    this.smoothed.bass = this.smoothValue(
      bassNorm,
      this.smoothed.bass,
      0.35,
      0.18,
    );
    this.smoothed.mid = this.smoothValue(
      midNorm,
      this.smoothed.mid,
      0.28,
      0.15,
    );
    this.smoothed.treble = this.smoothValue(
      trebleNorm,
      this.smoothed.treble,
      0.22,
      0.12,
    );

    const energy =
      this.smoothed.kick * 0.5 +
      this.smoothed.bass * 0.3 +
      this.smoothed.mid * 0.15 +
      this.smoothed.treble * 0.05;

    const beat = this.detectBeatFromLowEnergy(kickRaw, bassRaw);

    return {
      kick: this.smoothed.kick,
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      treble: this.smoothed.treble,
      energy,
      beat,
    };
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

  private handleChunk(buf: Buffer) {
    const { type, data } = this.parseChunk(buf);
    if (!data) return;

    const mono = this.toMono(data, this.audioChannels, type);
    for (let i = 0; i < mono.length; i++) {
      this.audioMono[this.audioWriteIndex] = this.conditionInputSample(mono[i]);
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

  private safeAvgRange(arr: number[], start: number, end: number) {
    let sum = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const value = arr[i];
      if (Number.isFinite(value)) {
        sum += value;
        count++;
      }
    }

    return count ? sum / count : 0;
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

  private noiseGate(value: number, threshold = 0.03) {
    return value > threshold ? (value - threshold) / (1 - threshold) : 0;
  }

  private conditionInputSample(sample: number) {
    const clipped = this.clamp(sample, -0.98, 0.98);
    const filtered = clipped - this.dcBlockX + 0.995 * this.dcBlockY;

    this.dcBlockX = clipped;
    this.dcBlockY = filtered;

    return this.clamp(filtered, -1, 1);
  }

  private detectBeatFromLowEnergy(kickRaw: number, bassRaw: number) {
    const lowEnergy = kickRaw * 0.72 + bassRaw * 0.28;
    const stats = this.getLowEnergyStats();

    this.pushLowEnergy(lowEnergy);

    if (this.beatCooldown > 0) this.beatCooldown--;
    if (this.lowEnergyHistoryCount < 16) return false;

    const dynamicFloor = stats.mean + stats.stdDev * 0.55 + 1e-6;
    const transient = lowEnergy - stats.mean;
    const ratio = lowEnergy / dynamicFloor;

    const beat =
      transient > stats.stdDev * 1.35 &&
      ratio > 1.24 &&
      this.beatCooldown === 0;
    if (beat) this.beatCooldown = 7;

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

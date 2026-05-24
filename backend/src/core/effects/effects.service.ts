import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { hsvToRgb, writeHsvToRgb } from '../utils/color.utils';
import { Effect } from './effects.entity';
import { AudioService } from './audio.service';

type EffectFunction = (
  ledCount: number,
  timeInput: number,
  brightness: number,
  hue?: number,
) => Promise<Uint8Array>;

type EffectMap = {
  [key: string]: EffectFunction;
};

@Injectable()
export class EffectsService {
  constructor(
    @InjectRepository(Effect)
    private readonly effectRepository: Repository<Effect>,
    private readonly audioService: AudioService,
  ) {}

  private readonly MAX_BRIGHTNESS = 0.8;

  private readonly TIME_INPUT: 'ms' | 'frames' = 'ms';

  private readonly SPEED_RAINBOW = 0.25;
  private readonly SPEED_COMET = 0.45;
  private readonly SPEED_AURORA = 0.4;
  private readonly SPEED_MUSIC = 0.35;
  private readonly SPEED_SMOOTH_FADE = 1.0;
  private readonly MUSIC_SEGMENT_COUNT = 8;

  private beatFlash = 0;
  private previousKick = 0;

  private lastMusicTimeSec: number | null = null;

  private musicFlow = 0;
  private musicTexture = 0;
  private pulseAge = 10;
  private pulseStrength = 0;
  private bassFrontAge = 10;
  private bassFrontStrength = 0;
  private dropFlash = 0;

  private smoothKick = 0;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreble = 0;
  private smoothEnergy = 0;

  public resetState(): void {
    this.beatFlash = 0;
    this.previousKick = 0;
    this.lastMusicTimeSec = null;
    this.musicFlow = 0;
    this.musicTexture = 0;
    this.pulseAge = 10;
    this.pulseStrength = 0;
    this.bassFrontAge = 10;
    this.bassFrontStrength = 0;
    this.dropFlash = 0;
    this.smoothKick = 0;
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
  }

  private clampBrightness(
    brightness: number | undefined | null,
    minBrightness = 0,
  ): number {
    const base = brightness ?? this.MAX_BRIGHTNESS * 0.5;
    if (base <= 0) return 0;
    return Math.max(minBrightness, Math.min(base, this.MAX_BRIGHTNESS));
  }

  private getTimeBase(timeInput: number): number {
    return this.TIME_INPUT === 'ms' ? timeInput / 1000 : timeInput;
  }

  private fillAll(buffer: Uint8Array, g: number, r: number, b: number) {
    for (let i = 0; i < buffer.length; i += 3) {
      buffer[i] = g;
      buffer[i + 1] = r;
      buffer[i + 2] = b;
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private softClip(x: number): number {
    return x / (1 + Math.abs(x) * 1.15);
  }

  private compressMusicValue(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;

    return this.clamp(value / (1 + value * 1.55), 0, 0.62);
  }

  private gaussian(distance: number, width: number): number {
    const safeWidth = Math.max(0.0001, width);
    const t = distance / safeWidth;
    return Math.exp(-0.5 * t * t);
  }

  private fract(value: number): number {
    return value - Math.floor(value);
  }

  private circularDistance(a: number, b: number, period = 1): number {
    const distance = Math.abs(a - b) % period;
    return Math.min(distance, period - distance);
  }

  private getMusicSegmentPosition(index: number, ledCount: number) {
    const safeLedCount = Math.max(1, ledCount);
    const segmentCount = Math.min(this.MUSIC_SEGMENT_COUNT, safeLedCount);
    const segmentIndex = Math.min(
      segmentCount - 1,
      Math.floor((index * segmentCount) / safeLedCount),
    );
    const segmentStart = Math.floor(
      (segmentIndex * safeLedCount) / segmentCount,
    );
    const segmentEnd = Math.floor(
      ((segmentIndex + 1) * safeLedCount) / segmentCount,
    );
    const segmentSize = Math.max(1, segmentEnd - segmentStart);
    const localIndex = this.clamp(index - segmentStart, 0, segmentSize - 1);
    const localX = segmentSize <= 1 ? 0.5 : localIndex / (segmentSize - 1);
    const reversed = segmentIndex % 2 === 1;

    return {
      segmentIndex,
      localX,
      orientedX: reversed ? 1 - localX : localX,
      centerDistance: Math.abs(localX - 0.5),
      phase: segmentIndex / segmentCount,
    };
  }

  private smoothAR(
    current: number,
    target: number,
    attackPerSec: number,
    releasePerSec: number,
    dt: number,
  ) {
    const rate = target > current ? attackPerSec : releasePerSec;
    const k = 1 - Math.exp(-rate * dt);
    return current + (target - current) * k;
  }

  async staticColor(
    ledCount: number,
    timeInput: number,
    brightness = 1,
    hue = 240,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness);
    if (safeBrightness === 0) return pixels;

    const [g0, r0, b0] = hsvToRgb(hue % 360, 1, 1);
    this.fillAll(
      pixels,
      Math.round(g0 * safeBrightness),
      Math.round(r0 * safeBrightness),
      Math.round(b0 * safeBrightness),
    );

    return pixels;
  }

  async rainbow(
    ledCount: number,
    timeInput: number,
    brightness: number,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness, 0.1);
    if (safeBrightness === 0) return pixels;

    const time = this.getTimeBase(timeInput) * this.SPEED_RAINBOW * 60;
    const cycles = 6;

    for (let i = 0; i < ledCount; i++) {
      const hue = ((i / ledCount) * 360 * cycles + time * 10) % 360;
      writeHsvToRgb(pixels, i * 3, hue, 1, safeBrightness);
    }

    return pixels;
  }

  async smoothFade(
    ledCount: number,
    timeInput: number,
    brightness: number,
    hue = 0,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness);
    if (safeBrightness === 0) return pixels;

    const time = this.getTimeBase(timeInput) * this.SPEED_SMOOTH_FADE;
    const fadeLength = 3.4;
    const phase = (time % fadeLength) / fadeLength;
    const fade = phase < 0.5 ? phase * 2 : 1 - (phase - 0.5) * 2;

    const [g0, r0, b0] = hsvToRgb(hue, 1, 1);

    this.fillAll(
      pixels,
      Math.round(g0 * fade * safeBrightness),
      Math.round(r0 * fade * safeBrightness),
      Math.round(b0 * fade * safeBrightness),
    );

    return pixels;
  }

  async music(
    ledCount: number,
    timeInput: number,
    brightness: number,
    hueBase = 0,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness ?? 0.7, 0.12);
    if (safeBrightness === 0) return pixels;

    const spectrum = this.audioService.getAudioSpectrum();

    const nowSec = this.getTimeBase(timeInput);
    const dt =
      this.lastMusicTimeSec === null ? 1 / 60 : nowSec - this.lastMusicTimeSec;
    this.lastMusicTimeSec = nowSec;

    const safeDt = this.clamp(dt, 0, 0.05);

    this.smoothKick = this.smoothAR(
      this.smoothKick,
      spectrum.kick,
      22,
      10,
      safeDt,
    );
    this.smoothBass = this.smoothAR(
      this.smoothBass,
      spectrum.bass,
      18,
      9,
      safeDt,
    );
    this.smoothMid = this.smoothAR(this.smoothMid, spectrum.mid, 10, 5, safeDt);
    this.smoothTreble = this.smoothAR(
      this.smoothTreble,
      spectrum.treble,
      8,
      4,
      safeDt,
    );
    this.smoothEnergy = this.smoothAR(
      this.smoothEnergy,
      spectrum.energy,
      8,
      4,
      safeDt,
    );

    const kickDelta = Math.max(0, this.smoothKick - this.previousKick);
    this.previousKick = this.smoothKick;

    const transientPunch = Math.pow(kickDelta, 0.78) * 1.25;

    const bassImpact = this.clamp(
      this.smoothKick * 0.62 + this.smoothBass * 0.32 + transientPunch * 0.28,
      0,
      1.5,
    );
    const bassHit =
      this.pulseAge > 0.11 && (spectrum.beat || transientPunch > 0.32);
    const dropHit =
      bassHit &&
      this.smoothEnergy > 0.55 &&
      this.smoothBass > 0.38 &&
      this.smoothMid > 0.28;

    if (bassHit) {
      this.beatFlash = 1;
      this.pulseAge = 0;
      this.pulseStrength = this.clamp(
        0.38 +
          this.smoothKick * 0.34 +
          this.smoothBass * 0.14 +
          transientPunch * 0.12,
        0,
        1,
      );
      this.bassFrontAge = 0;
      this.bassFrontStrength = this.clamp(0.32 + bassImpact * 0.58, 0, 1.15);
    }

    if (dropHit) {
      this.dropFlash = 1;
      this.pulseStrength = Math.min(1.12, this.pulseStrength + 0.16);
      this.bassFrontStrength = Math.min(1.25, this.bassFrontStrength + 0.22);
    }

    this.beatFlash = this.smoothAR(this.beatFlash, 0, 18, 11, safeDt);
    this.pulseStrength = this.smoothAR(this.pulseStrength, 0, 12, 4.8, safeDt);
    this.pulseAge += safeDt;
    this.bassFrontStrength = this.smoothAR(
      this.bassFrontStrength,
      0,
      18,
      5.4,
      safeDt,
    );
    this.bassFrontAge += safeDt;
    this.dropFlash = this.smoothAR(this.dropFlash, 0, 24, 6.2, safeDt);

    const flowDt = safeDt * this.SPEED_MUSIC;
    this.musicFlow += flowDt * (0.18 + this.smoothEnergy * 0.36);
    this.musicTexture +=
      flowDt * (0.28 + this.smoothTreble * 0.72 + this.beatFlash * 0.28);

    const fullWavePhase = this.musicFlow * Math.PI * 2;
    const texturePhase = this.musicTexture * Math.PI * 2;
    void hueBase;

    const frequencyBins =
      spectrum.spectrum?.length > 0
        ? spectrum.spectrum
        : [
            this.smoothKick,
            this.smoothBass,
            this.smoothBass,
            this.smoothMid,
            this.smoothMid,
            this.smoothTreble,
          ];
    const maxFrequency = Math.max(0.12, ...frequencyBins);
    const brightnessMultiplier =
      safeBrightness *
      (0.56 +
        this.clamp(this.smoothEnergy, 0, 1) * 0.42 +
        this.beatFlash * 0.08);

    for (let i = 0; i < ledCount; i++) {
      const segment = this.getMusicSegmentPosition(i, ledCount);
      const mirrorX = 1 - Math.abs(segment.localX * 2 - 1);
      const binPosition = mirrorX * (frequencyBins.length - 1);
      const lowerBin = Math.floor(binPosition);
      const upperBin = Math.min(frequencyBins.length - 1, lowerBin + 1);
      const binMix = binPosition - lowerBin;
      const lowerLevel = frequencyBins[lowerBin] ?? 0;
      const upperLevel = frequencyBins[upperBin] ?? lowerLevel;
      const frequencyLevel =
        lowerLevel + (upperLevel - lowerLevel) * binMix;
      const relativeLevel = this.clamp(frequencyLevel / maxFrequency, 0, 1);
      const binCenterDistance = Math.abs(binPosition - Math.round(binPosition));
      const barLine = Math.max(0, 1 - binCenterDistance / 0.36);
      const wave =
        Math.sin(
          (segment.phase * 1.7 + mirrorX * 2.4) * Math.PI * 2 -
            fullWavePhase,
        ) *
          0.5 +
        0.5;
      const shimmer =
        Math.sin(
          (segment.localX * 19 + segment.segmentIndex * 1.7) * Math.PI * 2 +
            texturePhase,
        ) *
          0.5 +
        0.5;
      const centerKick =
        this.gaussian(Math.abs(segment.localX - 0.5), 0.055) *
        (this.smoothKick * 0.34 + this.beatFlash * 0.18);
      const edgeTreble =
        Math.max(
          this.gaussian(segment.localX, 0.045),
          this.gaussian(1 - segment.localX, 0.045),
        ) *
        this.smoothTreble *
        0.22;
      const body =
        0.035 +
        Math.pow(relativeLevel, 0.82) * (0.32 + frequencyLevel * 0.58) +
        barLine * frequencyLevel * 0.2 +
        wave * frequencyLevel * 0.11 +
        shimmer * this.smoothTreble * relativeLevel * 0.08 +
        centerKick +
        edgeTreble +
        this.dropFlash * relativeLevel * 0.06;
      const value = this.compressMusicValue(
        body * brightnessMultiplier * (0.78 + barLine * 0.22),
      );

      const hue =
        (8 +
          (binPosition / Math.max(1, frequencyBins.length - 1)) * 276 +
          segment.segmentIndex * 2.5 +
          wave * 8 +
          this.musicTexture * 14) %
        360;
      const saturation = this.clamp(
        0.82 + relativeLevel * 0.14 - barLine * 0.08,
        0.48,
        1,
      );
      writeHsvToRgb(pixels, i * 3, hue, saturation, value);
    }

    return pixels;
  }

  async comet(
    ledCount: number,
    timeInput: number,
    brightness: number,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness);
    if (safeBrightness === 0) return pixels;

    const time = this.getTimeBase(timeInput) * this.SPEED_COMET;
    const head = (time * 30) % ledCount;
    const tailLength = Math.max(3, Math.floor(ledCount * 0.025));

    for (let i = 0; i < ledCount; i++) {
      const distance = (head - i + ledCount) % ledCount;
      if (distance > tailLength) continue;

      const fade = 1 - distance / tailLength;
      const value = fade * safeBrightness;

      const hue = (time * 120 + i * 0.2) % 360;
      writeHsvToRgb(pixels, i * 3, hue, 1, value);
    }

    return pixels;
  }

  async aurora(
    ledCount: number,
    timeInput: number,
    brightness: number,
  ): Promise<Uint8Array> {
    const pixels = new Uint8Array(ledCount * 3);
    const safeBrightness = this.clampBrightness(brightness, 0.15);
    if (safeBrightness === 0) return pixels;

    const time = this.getTimeBase(timeInput) * this.SPEED_AURORA;

    for (let i = 0; i < ledCount; i++) {
      const x = i / ledCount;

      const w1 = Math.sin(x * 3.0 + time * 1.3);
      const w2 = Math.sin(x * 5.5 + time * 0.9);
      const w3 = Math.sin(x * 1.6 + time * 2.2);

      const mix = (w1 * 0.55 + w2 * 0.35 + w3 * 0.1) * 0.5 + 0.5;

      let value = safeBrightness * (0.22 + 0.78 * mix);

      const spark = Math.sin(i * 12.345 + time * 10);
      if (spark > 0.92) value += (spark - 0.92) * safeBrightness * 0.6;

      value = Math.min(1, value);

      const hue = (150 + 140 * mix) % 360;
      writeHsvToRgb(pixels, i * 3, hue, 1, value);
    }

    return pixels;
  }

  getEffectByName(effectName: string): EffectFunction | undefined {
    const effects: EffectMap = {
      rainbow: (l: number, t = 0, b: number) => this.rainbow(l, t, b),
      music: (l: number, t = 0, b: number, h = 0) => this.music(l, t, b, h),
      smoothFade: (l: number, t = 0, b: number, h = 0) =>
        this.smoothFade(l, t, b, h),
      comet: (l: number, t = 0, b: number) => this.comet(l, t, b),
      aurora: (l: number, t = 0, b: number) => this.aurora(l, t, b),
      staticColor: (l: number, t = 0, b: number, h = 0) =>
        this.staticColor(l, t, b, h),
    };

    return effects[effectName];
  }

  async findAll(): Promise<Effect[]> {
    try {
      return await this.effectRepository.find();
    } catch (e) {
      throw new InternalServerErrorException(e, 'Effects not found');
    }
  }

  async updateEffectStatus(id: number, active: boolean) {
    if (active) {
      await this.effectRepository
        .createQueryBuilder()
        .update()
        .set({ active: false })
        .where('id != :id', { id })
        .execute();
    }

    const result = await this.effectRepository.update(id, { active });
    if (result.affected === 0) {
      throw new NotFoundException(`Effect with id ${id} not found`);
    }
  }
}

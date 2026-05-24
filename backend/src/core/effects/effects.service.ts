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
    this.musicFlow +=
      flowDt *
      (0.34 +
        this.smoothBass * 0.7 +
        this.smoothKick * 0.45 +
        this.beatFlash * 0.32);
    this.musicTexture +=
      flowDt * (0.42 + this.smoothMid * 0.4 + this.smoothTreble * 1.1);

    const fullWavePhase = this.musicFlow * Math.PI * 2;
    const texturePhase = this.musicTexture * Math.PI * 2;
    void hueBase;

    const lowDrive = this.clamp(
      this.smoothKick * 0.7 + this.smoothBass * 0.45 + this.beatFlash * 0.25,
      0,
      1.25,
    );
    const colorDrive = this.clamp(
      this.smoothMid * 0.65 + this.smoothTreble * 0.55 + this.dropFlash * 0.18,
      0,
      1.25,
    );
    const tailLength = 0.11 + lowDrive * 0.09 + this.smoothMid * 0.035;
    const headWidth = 0.018 + this.pulseStrength * 0.014;
    const sparkleAmount = this.clamp(
      this.smoothTreble * 0.75 + this.beatFlash * 0.2,
      0,
      1,
    );
    const brightnessMultiplier =
      safeBrightness *
      (0.42 +
        this.clamp(this.smoothEnergy, 0, 1) * 0.28 +
        this.beatFlash * 0.04);

    for (let i = 0; i < ledCount; i++) {
      const segment = this.getMusicSegmentPosition(i, ledCount);
      const head =
        (this.musicFlow * (0.85 + segment.phase * 0.22) +
          segment.phase * 0.31) %
        1;
      const mirrorHead = 1 - head;
      const distance = this.circularDistance(segment.orientedX, head);
      const mirrorDistance = this.circularDistance(segment.orientedX, mirrorHead);
      const primaryTail = Math.max(0, 1 - distance / tailLength);
      const secondaryTail = Math.max(0, 1 - mirrorDistance / (tailLength * 0.72));
      const headCore =
        this.gaussian(distance, headWidth) * (0.52 + this.pulseStrength * 0.42);
      const mirroredCore =
        this.gaussian(mirrorDistance, headWidth * 1.25) *
        (0.18 + this.smoothBass * 0.18);
      const bpmWave =
        Math.sin(
          (segment.localX * 2.2 + segment.phase * 0.9) * Math.PI * 2 -
            fullWavePhase,
        ) *
          0.5 +
        0.5;
      const body =
        Math.pow(primaryTail, 1.65) * (0.26 + lowDrive * 0.56) +
        Math.pow(secondaryTail, 2.1) * (0.12 + this.smoothMid * 0.2) +
        headCore +
        mirroredCore +
        bpmWave * this.smoothEnergy * 0.08;
      const sparkleSeed = this.fract(
        Math.sin(
          i * 12.9898 +
            segment.segmentIndex * 78.233 +
            this.musicTexture * 24.17,
        ) * 43758.5453,
      );
      const sparkleGate = 0.993 - sparkleAmount * 0.055;
      const sparkle =
        sparkleSeed > sparkleGate
          ? Math.pow((sparkleSeed - sparkleGate) / (1 - sparkleGate), 2.2) *
            (0.18 + sparkleAmount * 0.4)
          : 0;
      const value = this.compressMusicValue(
        (0.025 + body + sparkle + transientPunch * 0.045) *
          brightnessMultiplier,
      );

      const hue =
        (265 +
          colorDrive * 72 +
          lowDrive * -34 +
          segment.phase * 28 +
          segment.orientedX * 18 +
          Math.sin(texturePhase + segment.phase * Math.PI * 2) * 12) %
        360;
      const saturation = this.clamp(
        0.86 - headCore * 0.18 - sparkle * 0.5 + this.smoothTreble * 0.08,
        0.34,
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

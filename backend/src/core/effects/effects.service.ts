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

  private gaussian(distance: number, width: number): number {
    const safeWidth = Math.max(0.0001, width);
    const t = distance / safeWidth;
    return Math.exp(-0.5 * t * t);
  }

  private fract(value: number): number {
    return value - Math.floor(value);
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
    const safeBrightness = this.clampBrightness(brightness, 0.08);
    if (safeBrightness === 0) return pixels;

    const spectrum = this.audioService.getAudioSpectrum();

    const nowSec = this.getTimeBase(timeInput) * this.SPEED_MUSIC;
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

    const kickIsolation =
      this.smoothKick / (this.smoothBass * 0.6 + this.smoothMid * 0.3 + 0.3);

    const kickDelta = Math.max(0, this.smoothKick - this.previousKick);
    this.previousKick = this.smoothKick;

    const transientPunch =
      Math.pow(kickDelta, 0.78) * 1.75 * (1 + kickIsolation * 0.3);

    const bassImpact = this.clamp(
      this.smoothKick * 0.62 + this.smoothBass * 0.32 + transientPunch * 0.28,
      0,
      1.5,
    );
    const bassHit = spectrum.beat || transientPunch > 0.32;
    const dropHit =
      bassHit &&
      this.smoothEnergy > 0.55 &&
      this.smoothBass > 0.38 &&
      this.smoothMid > 0.28;

    if (bassHit) {
      this.beatFlash = 1;
      this.pulseAge = 0;
      this.pulseStrength = this.clamp(
        0.55 +
          this.smoothKick * 0.45 +
          this.smoothBass * 0.2 +
          transientPunch * 0.18,
        0,
        1.35,
      );
      this.bassFrontAge = 0;
      this.bassFrontStrength = this.clamp(0.48 + bassImpact * 0.82, 0, 1.65);
    }

    if (dropHit) {
      this.dropFlash = 1;
      this.pulseStrength = Math.min(1.55, this.pulseStrength + 0.25);
      this.bassFrontStrength = Math.min(1.85, this.bassFrontStrength + 0.35);
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

    const melodicDensity = this.clamp(
      this.smoothMid * 0.78 + this.smoothEnergy * 0.55,
      0,
      1.25,
    );
    const lowDrive = this.clamp(
      this.smoothBass * 0.75 + this.smoothKick * 0.45,
      0,
      1.3,
    );
    const trebleDust = this.clamp(
      this.smoothTreble * 0.9 + this.beatFlash * 0.2,
      0,
      1.15,
    );

    this.musicFlow +=
      safeDt * (0.035 + this.smoothEnergy * 0.42 + this.dropFlash * 0.55);
    this.musicTexture +=
      safeDt * (0.32 + this.smoothTreble * 1.05 + this.dropFlash * 1.15);

    const waveRepeats = Math.max(4, Math.min(12, Math.round(ledCount / 420)));
    const laneLength = ledCount / waveRepeats;
    const travelHead = (this.musicFlow * laneLength * 0.82) % laneLength;
    const baseWidth = Math.max(
      laneLength * 0.16,
      laneLength * (0.18 + melodicDensity * 0.24 + this.dropFlash * 0.08),
    );
    const baseThickness = 0.18 + melodicDensity * 0.55 + this.dropFlash * 0.22;
    const glowFloor = 0.018 + this.smoothEnergy * 0.08;

    const pulseCenter = (ledCount - 1) * 0.5;
    const pulseRadius = this.pulseAge * ledCount * (0.85 + this.smoothKick * 0.55);
    const pulseShellWidth = Math.max(
      1.3,
      ledCount * (0.025 + this.pulseStrength * 0.024),
    );
    const pulseFade = Math.max(0, 1 - this.pulseAge * 1.9);
    const pulseCoreFade = Math.max(0, 1 - this.pulseAge * 4.6);
    const pulseCoreWidth = Math.max(
      1.8,
      ledCount * (0.045 + this.pulseStrength * 0.025),
    );
    void hueBase;

    const sceneHueBase = 275;
    const hueDrift =
      this.smoothEnergy * -34 +
      this.smoothMid * 48 +
      this.smoothTreble * -18 +
      transientPunch * 18 +
      this.dropFlash * 28;
    const bassFrontPosition =
      this.bassFrontAge * laneLength * (2.6 + this.smoothKick * 1.2);
    const bassFrontWidth = Math.max(
      1.6,
      laneLength * (0.035 + this.bassFrontStrength * 0.032),
    );
    const bassFrontFade = Math.max(0, 1 - this.bassFrontAge * 2.35);
    const brightnessMultiplier =
      safeBrightness *
      (0.42 +
        this.smoothEnergy * 0.8 +
        this.beatFlash * 0.28 +
        this.dropFlash * 0.46);

    for (let i = 0; i < ledCount; i++) {
      const laneIndex = Math.floor(i / laneLength);
      const laneX = i - laneIndex * laneLength;
      const laneOffset = (laneIndex % 3) * laneLength * 0.18;
      const baseCenter = (travelHead + laneOffset) % laneLength;
      const distToBand = Math.min(
        Math.abs(laneX - baseCenter),
        laneLength - Math.abs(laneX - baseCenter),
      );
      const leadingBand = this.gaussian(distToBand, baseWidth);
      const trailingBand = this.gaussian(
        Math.min(
          Math.abs(laneX - ((baseCenter - baseWidth * 0.72 + laneLength) % laneLength)),
          laneLength -
            Math.abs(laneX - ((baseCenter - baseWidth * 0.72 + laneLength) % laneLength)),
        ),
        baseWidth * 1.45,
      );
      const bandBody = leadingBand * (0.42 + baseThickness) + trailingBand * 0.22;
      const bandTexture =
        (Math.sin(i * 0.095 - this.musicFlow * 8.2) * 0.5 + 0.5) *
          (0.08 + lowDrive * 0.18) +
        (Math.sin(i * 0.16 - this.musicTexture * 5.6 + this.smoothMid * 3) *
          0.5 +
          0.5) *
          (0.05 + melodicDensity * 0.08);
      const baseWave = glowFloor + bandBody * (0.35 + bandTexture);

      const centerDistance = Math.abs(i - pulseCenter);
      const pulseCore =
        this.gaussian(centerDistance, pulseCoreWidth) *
        pulseCoreFade *
        (0.45 + this.pulseStrength * 0.95);
      const pulseShell =
        this.gaussian(Math.abs(centerDistance - pulseRadius), pulseShellWidth) *
        pulseFade *
        this.pulseStrength *
        1.35;
      const bassFront =
        this.gaussian(
          Math.min(
            Math.abs(laneX - bassFrontPosition),
            laneLength - Math.abs(laneX - bassFrontPosition),
          ),
          bassFrontWidth,
        ) *
        bassFrontFade *
        this.bassFrontStrength *
        1.95;

      const sparkleSeed = this.fract(
        Math.sin(i * 12.9898 + this.musicTexture * 17.123 + this.musicFlow * 9.37) *
          43758.5453,
      );
      const sparkleGate = 0.994 - trebleDust * 0.045 - this.dropFlash * 0.016;
      const sparkleBurst =
        sparkleSeed > sparkleGate
          ? Math.pow((sparkleSeed - sparkleGate) / (1 - sparkleGate), 2.7)
          : 0;
      const sparkle =
        sparkleBurst *
        (0.16 + trebleDust * 0.82 + this.dropFlash * 0.55) *
        (0.45 + leadingBand * 0.38 + this.beatFlash * 0.28);

      const undertow =
        (Math.sin(i * 0.043 - this.musicFlow * 3.4) * 0.5 + 0.5) *
        (0.025 + lowDrive * 0.045);

      let value =
        (baseWave +
          pulseCore +
          pulseShell +
          bassFront +
          sparkle +
          undertow +
          transientPunch * 0.16 +
          this.dropFlash * 0.12 +
          this.beatFlash * 0.05) *
        brightnessMultiplier;

      value = this.softClip(value * 1.55);
      value = this.clamp(value, 0, 1);
      value = Number.isFinite(value) ? value : 0;

      const hue =
        (sceneHueBase +
          hueDrift +
          leadingBand * (20 + melodicDensity * 26) -
          trailingBand * 20 +
          pulseShell * 28 +
          bassFront * 46 +
          sparkle * -82 +
          i * (0.05 + this.smoothTreble * 0.06)) %
        360;
      const saturation = this.clamp(
        0.88 -
          sparkle * 0.8 -
          this.dropFlash * 0.38 -
          bassFront * 0.2 -
          pulseCore * 0.22,
        0.06,
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

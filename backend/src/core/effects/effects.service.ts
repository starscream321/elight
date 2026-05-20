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
  private readonly SPEED_COMET = 0.12;
  private readonly SPEED_AURORA = 0.4;
  private readonly SPEED_MUSIC = 0.35;
  private readonly SPEED_SMOOTH_FADE = 1.0;

  private beatFlash = 0;
  private beatBurst = 0;
  private previousKick = 0;

  private lastMusicTimeSec: number | null = null;

  private phaseKick = 0;
  private phaseBass = 0;
  private phaseMid = 0;
  private phaseTreble = 0;

  private smoothKick = 0;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreble = 0;
  private smoothEnergy = 0;

  public resetState(): void {
    this.beatFlash = 0;
    this.beatBurst = 0;
    this.previousKick = 0;
    this.lastMusicTimeSec = null;
    this.phaseKick = 0;
    this.phaseBass = 0;
    this.phaseMid = 0;
    this.phaseTreble = 0;
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

    const kickAmp =
      Math.pow(this.smoothKick, 0.95) * 1.85 * (1 + kickIsolation * 0.2);
    const bassAmp = Math.pow(this.smoothBass, 0.8) * 1.1;
    const midAmp = Math.pow(this.smoothMid, 0.9) * 0.42;
    const trebleAmp = Math.pow(this.smoothTreble, 0.95) * 0.32;

    const kickDelta = Math.max(0, this.smoothKick - this.previousKick);
    this.previousKick = this.smoothKick;

    const transientPunch =
      Math.pow(kickDelta, 0.76) * 3.8 * (1 + kickIsolation * 0.25);

    if (spectrum.beat) {
      this.beatFlash = 1;
      this.beatBurst = Math.min(1.6, this.beatBurst + 1.05);
    }
    this.beatFlash = this.smoothAR(this.beatFlash, 0, 16, 14, safeDt);
    this.beatBurst = this.smoothAR(this.beatBurst, 0, 18, 10, safeDt);

    const energyBoost = 0.32 + this.smoothEnergy * 0.55;
    const beatBoost = 1 + this.beatFlash * 1.55 + this.beatBurst * 0.65;

    const speedKick = 2.2 + this.smoothEnergy * 1.0;
    const speedBass = 1.6 + this.smoothEnergy * 0.8;
    const speedMid = 1.1 + this.smoothEnergy * 0.7;
    const speedTreble = 0.8 + this.smoothEnergy * 0.6;

    this.phaseKick += safeDt * speedKick;
    this.phaseBass += safeDt * speedBass;
    this.phaseMid += safeDt * speedMid;
    this.phaseTreble += safeDt * speedTreble;

    const hueBeatShift =
      this.beatFlash * 30 +
      this.beatBurst * 18 +
      transientPunch * 24 +
      this.smoothMid * 16;

    // Pre-calculate constant values outside the loop
    const phaseKickOffset = this.phaseKick * 6.2;
    const phaseBassOffset = this.phaseBass * 4.8;
    const phaseMidOffset = this.phaseMid * 4.1;
    const phaseTrebleOffset = this.phaseTreble * 3.2;
    const brightnessMultiplier = safeBrightness * energyBoost * beatBoost;
    const beatCenter =
      (this.phaseKick * 17 + this.beatBurst * ledCount * 0.11) % ledCount;
    const beatWidth = Math.max(3, ledCount * (0.022 + this.beatBurst * 0.035));
    const bassSweep = this.phaseBass * ledCount * 0.18;

    for (let i = 0; i < ledCount; i++) {
      const beatDistance = Math.min(
        Math.abs(i - beatCenter),
        ledCount - Math.abs(i - beatCenter),
      );
      const beatPulse =
        Math.max(0, 1 - beatDistance / beatWidth) *
        (this.beatBurst * 2.4 + transientPunch * 0.85);
      const kickWave =
        (Math.sin(i * 0.04 + phaseKickOffset) * 0.5 + 0.5) * kickAmp;
      const bassWave =
        (Math.sin(i * 0.052 + phaseBassOffset) * 0.5 + 0.5) * bassAmp;
      const midWave =
        Math.pow(Math.sin(i * 0.09 + phaseMidOffset) * 0.5 + 0.5, 1.4) * midAmp;
      const trebleWave =
        Math.pow(Math.sin(i * 0.17 + phaseTrebleOffset) * 0.5 + 0.5, 3.2) *
        trebleAmp;
      const bassRibbon =
        Math.pow(Math.sin(i * 0.021 - bassSweep) * 0.5 + 0.5, 2.1) *
        this.smoothBass;
      const trebleSpark =
        Math.pow(
          Math.sin(i * 1.73 + phaseTrebleOffset * 2.7 + this.phaseMid) * 0.5 +
            0.5,
          9,
        ) *
        this.smoothTreble *
        (0.03 + this.beatFlash * 0.45);
      const texture =
        Math.sin(i * 0.31 + phaseMidOffset + this.smoothEnergy * 4) * 0.012 +
        Math.sin(i * 0.73 - phaseTrebleOffset) * 0.008;

      let value =
        (kickWave * 0.24 +
          bassWave * 0.09 +
          bassRibbon * 0.14 +
          midWave * 0.035 +
          trebleWave * 0.02 +
          trebleSpark * 0.08 +
          beatPulse * 1.45 +
          this.beatFlash * 0.18 +
          transientPunch * 0.55 +
          texture) *
        brightnessMultiplier;

      value = this.softClip(value);
      value = this.clamp(value, 0, 1);
      value = Number.isFinite(value) ? value : 0;

      const hue =
        (hueBase +
          i * (0.28 + this.smoothTreble * 0.25) +
          hueBeatShift +
          bassRibbon * 18 +
          midWave * 8 -
          beatPulse * 42) %
        360;
      writeHsvToRgb(pixels, i * 3, hue, 1, value);
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
    const head = Math.floor(time * 30) % ledCount;
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

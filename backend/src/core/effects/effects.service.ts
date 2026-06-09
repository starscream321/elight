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
import {
  EffectOptions,
  LedPixel,
  renderWledMusicEffect,
} from './wled-music.effect';

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
  private readonly SPEED_SMOOTH_FADE = 1.0;
  private readonly MUSIC_PIXEL_FADE = 0.82;
  private readonly MUSIC_PEAK_FLASH_DECAY = 0.78;

  private previousMusicPixels: LedPixel[] = [];

  public resetState(): void {
    this.previousMusicPixels = [];
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
    const safeBrightness = this.clampBrightness(brightness ?? 0.7);
    if (safeBrightness === 0) {
      this.previousMusicPixels = [];
      return pixels;
    }

    void timeInput;
    void hueBase;

    const audio = this.audioService.getWledLikeAudioData();
    const options: EffectOptions = {
      ledCount,
      smoothing: this.MUSIC_PIXEL_FADE,
      peakMultiplier: 1.35,
      minPeakVolume: 35,
      peakFlashDecay: this.MUSIC_PEAK_FLASH_DECAY,
    };

    this.previousMusicPixels = renderWledMusicEffect(
      audio,
      this.previousMusicPixels,
      options,
    );

    for (let i = 0; i < this.previousMusicPixels.length; i++) {
      const pixel = this.previousMusicPixels[i];
      const offset = i * 3;

      pixels[offset] = Math.round(pixel.g * safeBrightness);
      pixels[offset + 1] = Math.round(pixel.r * safeBrightness);
      pixels[offset + 2] = Math.round(pixel.b * safeBrightness);
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

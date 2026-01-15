import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { hsvToRgb } from '../utils/color.utils';
import { getAudioSpectrum } from '../utils/audio.utils';
import { Effect } from './effects.entity';

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
    ) {}

    private readonly MAX_BRIGHTNESS = 0.8;

    private readonly TIME_INPUT: 'ms' | 'frames' = 'ms';

    private readonly SPEED_RAINBOW = 0.25;
    private readonly SPEED_COMET = 0.12;
    private readonly SPEED_AURORA = 0.4;
    private readonly SPEED_MUSIC = 0.35;
    private readonly SPEED_SMOOTH_FADE = 1.0;

    private beatFlash = 0;
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
            const [g, r, b] = hsvToRgb(hue, 1, safeBrightness);

            const j = i * 3;
            pixels[j] = g;
            pixels[j + 1] = r;
            pixels[j + 2] = b;
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

        const spectrum = getAudioSpectrum();

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
        this.smoothMid = this.smoothAR(this.smoothMid, spectrum.mid, 16, 8, safeDt);
        this.smoothTreble = this.smoothAR(
            this.smoothTreble,
            spectrum.treble,
            14,
            7,
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
            Math.pow(this.smoothKick, 0.85) * 5.6 * (1 + kickIsolation * 0.35);
        const bassAmp = Math.pow(this.smoothBass, 0.7) * 4.2;
        const midAmp = Math.pow(this.smoothMid, 0.65) * 3.8;
        const trebleAmp = Math.pow(this.smoothTreble, 0.6) * 2.8;

        const kickDelta = Math.max(0, this.smoothKick - this.previousKick);
        this.previousKick = this.smoothKick;

        const transientPunch =
            Math.pow(kickDelta, 0.75) * 6.5 * (1 + kickIsolation * 0.3);

        if (spectrum.beat) this.beatFlash = 1;
        this.beatFlash = this.smoothAR(this.beatFlash, 0, 12, 12, safeDt);

        const energyBoost = 1 + this.smoothEnergy * 0.45;
        const beatBoost = 1 + this.beatFlash * 0.75;

        const speedKick = 2.2 + this.smoothEnergy * 1.0;
        const speedBass = 1.6 + this.smoothEnergy * 0.8;
        const speedMid = 1.1 + this.smoothEnergy * 0.7;
        const speedTreble = 0.8 + this.smoothEnergy * 0.6;

        this.phaseKick += safeDt * speedKick;
        this.phaseBass += safeDt * speedBass;
        this.phaseMid += safeDt * speedMid;
        this.phaseTreble += safeDt * speedTreble;

        const hueBeatShift = this.beatFlash * 22 + transientPunch * 18;

        // Pre-calculate constant values outside the loop
        const phaseKickOffset = this.phaseKick * 6.2;
        const phaseBassOffset = this.phaseBass * 4.8;
        const phaseMidOffset = this.phaseMid * 4.1;
        const phaseTrebleOffset = this.phaseTreble * 3.2;
        const brightnessMultiplier = safeBrightness * energyBoost * beatBoost;

        for (let i = 0; i < ledCount; i++) {
            const kickWave = Math.sin(i * 0.04 + phaseKickOffset) * kickAmp;
            const bassWave = Math.sin(i * 0.052 + phaseBassOffset) * bassAmp;
            const midWave = Math.sin(i * 0.09 + phaseMidOffset) * midAmp;
            const trebleWave = Math.sin(i * 0.13 + phaseTrebleOffset) * trebleAmp;

            let value =
                (kickWave + bassWave + midWave + trebleWave + transientPunch) *
                brightnessMultiplier;

            value = this.softClip(value);
            value = this.clamp(value, 0, 1);

            const hue = (hueBase + i * 0.38 + hueBeatShift) % 360;
            const [g, r, b] = hsvToRgb(hue, 1, value);

            const j = i * 3;
            pixels[j] = g;
            pixels[j + 1] = r;
            pixels[j + 2] = b;
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
            const [g, r, b] = hsvToRgb(hue, 1, value);

            const j = i * 3;
            pixels[j] = g;
            pixels[j + 1] = r;
            pixels[j + 2] = b;
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
            const [g, r, b] = hsvToRgb(hue, 1, value);

            const j = i * 3;
            pixels[j] = g;
            pixels[j + 1] = r;
            pixels[j + 2] = b;
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

    async findAll() {
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

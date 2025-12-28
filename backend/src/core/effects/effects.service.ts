import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { hsvToRgb } from '../utils/color.utils';
import { getAudioSpectrum } from '../utils/audio.utils';
import { Effect } from './effects.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EffectsService {
    constructor(
        @InjectRepository(Effect)
        private effectRepo: Repository<Effect>,
    ) {}

    private beatFlash = 0;
    private prevKick = 0;

    private readonly MAX_BRIGHTNESS = 0.8;

    private normalizeBrightness(
        brightness: number | undefined | null,
        min = 0
    ): number {
        if (brightness === undefined || brightness === null) {
            brightness = this.MAX_BRIGHTNESS * 0.5;
        }

        if (brightness <= 0) return 0;
        
        let br = brightness;

        br = Math.min(br, this.MAX_BRIGHTNESS);

        return Math.max(min, br);
    }


    // ------------------------------------------------------------
    //  STATIC COLOR (исправлено — яркость работает правильно)
    // ------------------------------------------------------------
    async staticColor(
        length: number,
        offset: number,
        brightness: number = 1,
        hue: number = 240
    ): Promise<Uint8Array> {

        const out = new Uint8Array(length * 3);
        const br = this.normalizeBrightness(brightness);

        if (br === 0) return out;

        let [g, r, b] = hsvToRgb(hue % 360, 1, 1);

        g = Math.round(g * br);
        r = Math.round(r * br);
        b = Math.round(b * br);

        for (let i = 0; i < length; i++) {
            const j = i * 3;
            out[j] = g;
            out[j + 1] = r;
            out[j + 2] = b;
        }

        return out;
    }

    // ------------------------------------------------------------
    //  RAINBOW — динамика может работать плохо без min brightness
    // ------------------------------------------------------------
    async rainbow(length: number, offset: number, brightness: number): Promise<Uint8Array> {
        const out = new Uint8Array(length * 3);
        const br = this.normalizeBrightness(brightness, 0.1); // мягкий минимум

        const cycles = 6;
        const speed = offset * 0.6;

        for (let i = 0; i < length; i++) {
            const hue = ((i / length) * 360 * cycles + speed) % 360;
            const [g, r, b] = hsvToRgb(hue, 1, br);

            const j = i * 3;
            out[j] = g;
            out[j + 1] = r;
            out[j + 2] = b;
        }

        return out;
    }

    // ------------------------------------------------------------
    //  SMOOTH FADE
    // ------------------------------------------------------------
    async smoothFade(length: number, offset: number, brightness: number, hueColor: number): Promise<Uint8Array> {
        const br = this.normalizeBrightness(brightness);
        const out = new Uint8Array(length * 3);

        if (br === 0) return out;

        const fadeDuration = 170;
        const half = fadeDuration / 2;
        const t = offset % fadeDuration;

        const [r0, g0, b0] = hsvToRgb(hueColor, 1, 1);
        const calc = (v: number) =>
            t < half ? (v * t) / half : v * (1 - (t - half) / half);

        const r = calc(r0) * br;
        const g = calc(g0) * br;
        const b = calc(b0) * br;

        let j = 0;
        for (let i = 0; i < length; i += 4) {
            out[j++] = g; out[j++] = r; out[j++] = b;
            out[j++] = g; out[j++] = r; out[j++] = b;
            out[j++] = g; out[j++] = r; out[j++] = b;
            out[j++] = g; out[j++] = r; out[j++] = b;
        }
        return out;
    }

    // ------------------------------------------------------------
    //  MUSIC EFFECT (улучшенная версия)
    // ------------------------------------------------------------
    async music(length: number, offset: number, brightness: number, hueColor = 0): Promise<Uint8Array> {
        const s = getAudioSpectrum();
        const out = new Uint8Array(length * 3);

        const br = this.normalizeBrightness(brightness, 0.08);
        if (br === 0) return out;

        // Kick isolation
        const kickIso = s.kick / (s.bass * 0.6 + s.mid * 0.3 + 0.3);

        const kick   = Math.pow(s.kick, 0.85) * 6.2 * (1 + kickIso * 0.4);
        const bass   = Math.pow(s.bass, 0.70) * 4.8;
        const mid    = Math.pow(s.mid,  0.65) * 4.2;
        const treble = Math.pow(s.treble, 0.60) * 3.0;

        const energyBoost = 1 + s.energy * 0.55;

        const transient = Math.max(0, s.kick - this.prevKick);
        this.prevKick = s.kick;

        const transientPunch =
            (transient ** 0.7) * 12 * (1 + kickIso * 0.4);

        if (s.beat) this.beatFlash = 1.0;
        this.beatFlash *= 0.92;

        const beatBoost = 1 + this.beatFlash * 0.9;

        const hueKickShift = transientPunch * 45 + this.beatFlash * 25;

        let j = 0;

        const oKick = offset * 3.0;
        const oBass = offset * 2.0;
        const oMid  = offset * 1.4;

        const waveKick = (i: number) =>
            Math.sin((i + oKick) * 0.040) * kick;

        const waveMix = (i: number) =>
            bass   * Math.sin((i + oBass) * 0.052) +
            mid    * Math.sin((i + oMid)  * 0.090) +
            treble * Math.sin(i * 0.13);

        const softComp = (v: number) => v / (1 + v * 1.1);

        for (let i = 0; i < length; i += 4) {
            const ids = [i, i + 1, i + 2, i + 3];

            for (const idx of ids) {
                let v =
                    (waveKick(idx) + waveMix(idx) + transientPunch) *
                    br * energyBoost * beatBoost;

                v = Math.max(0, Math.min(1, v));
                v = softComp(v);

                const hue = (hueColor + idx * 0.38 + hueKickShift) % 360;
                const c = hsvToRgb(hue, 1, v);

                out[j++] = c[0];
                out[j++] = c[1];
                out[j++] = c[2];
            }
        }

        return out;
    }

    // ------------------------------------------------------------
    //  COMET
    // ------------------------------------------------------------
    async comet(length: number, offset: number, brightness: number): Promise<Uint8Array> {
        const out = new Uint8Array(length * 3);
        const br = this.normalizeBrightness(brightness);

        if (br === 0) return out;

        const head = offset % length;
        const tail = Math.max(3, Math.floor(length * 0.025));

        for (let i = 0; i < length; i++) {
            const d = (head - i + length) % length;
            if (d > tail) continue;

            const fade = 1 - d / tail;
            const v = fade * br;

            const hue = (offset * 2 + i * 0.2) % 360;
            const [g, r, b] = hsvToRgb(hue, 1, v);

            const j = i * 3;
            out[j] = g;
            out[j + 1] = r;
            out[j + 2] = b;
        }

        return out;
    }

    // ------------------------------------------------------------
    //  AURORA
    // ------------------------------------------------------------
    async aurora(length: number, offset: number, brightness: number): Promise<Uint8Array> {
        const out = new Uint8Array(length * 3);
        const br = this.normalizeBrightness(brightness, 0.15);

        if (br === 0) return out;

        const t = offset * 0.003;

        const hueStart = 150;
        const hueEnd   = 290;

        for (let i = 0; i < length; i++) {
            const x = i / length;

            const w1 = Math.sin(x * 3.0 + t * 1.3);
            const w2 = Math.sin(x * 5.5 + t * 0.9);
            const w3 = Math.sin(x * 1.6 + t * 2.2);

            const mix = (w1 * 0.55 + w2 * 0.35 + w3 * 0.10) * 0.5 + 0.5;

            let v = br * (0.22 + 0.78 * mix);

            const hue = hueStart + (hueEnd - hueStart) * mix;

            const sparkSeed = Math.sin(i * 12.345 + offset * 0.12);
            if (sparkSeed > 0.92) {
                const sparkAmp = (sparkSeed - 0.92) * 12.5;
                v += sparkAmp * br * 0.6;
            }

            v = Math.min(v, 1);

            const c = hsvToRgb(hue % 360, 1, v);

            const j = i * 3;
            out[j] = c[0];
            out[j + 1] = c[1];
            out[j + 2] = c[2];
        }

        return out;
    }

    // ------------------------------------------------------------
    //  EFFECTS MAP
    // ------------------------------------------------------------
    getEffectByName(effectName: string) {
        const map = {
            rainbow: (l: number, o = 0, b: number) => this.rainbow(l, o, b),
            music: (l: number, o = 0, b: number, h = 0) => this.music(l, o, b, h),
            smoothFade: (l: number, o = 0, b: number, h = 0) => this.smoothFade(l, o, b, h),
            comet: (l: number, o = 0, b: number) => this.comet(l, o, b),
            aurora: (l: number, o = 0, b: number) => this.aurora(l, o, b),
            staticColor: (l: number, o = 0, b: number, h: number) =>
                this.staticColor(l, o, b, h),
        };
        return (map as any)[effectName];
    }

    async findAll() {
        try {
            return await this.effectRepo.find();
        } catch (e) {
            throw new InternalServerErrorException(e, 'Effects not found');
        }
    }

    async updateEffectStatus(id: number, active: boolean) {
        if (active) {
            await this.effectRepo
                .createQueryBuilder()
                .update()
                .set({ active: false })
                .where('id != :id', { id })
                .execute();
        }
        const result = await this.effectRepo.update(id, { active });
        if (result.affected === 0) {
            throw new NotFoundException(`Effect with id ${id} not found`);
        }
    }
}

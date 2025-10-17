import {Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import { createColorArray, hsvToRgb } from '../../utils/color.utils';
import { getAudioSpectrum } from '../../utils/audio.utils';
import { Effect } from './effects.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EffectsService {
    constructor(
        @InjectRepository(Effect)
        private effectRepo: Repository<Effect>,
    ) {}
    private smoothed = { bass: 0, mid: 0, treble: 0 };
    private barLevels: number[] = [0, 0, 0];



    private smoothValue(curr: number, prev: number, rise = 0.3, fall = 0.1) {
        const alpha = curr > prev ? rise : fall; // вверх быстрее, вниз медленнее
        return prev + (curr - prev) * alpha;
    }



    private padFrame(data: number[]): Uint8Array {
        const frame = new Uint8Array(512);
        frame.set(data.slice(0, 512));
        return frame;
    }


    async rainbow(length: number, offset: number, brightness: number): Promise<Uint8Array> {
        const data = createColorArray(length, (i) => {
            const hue = (((i + offset) % length) / length) * 360;
            const [r, g, b] = hsvToRgb(hue, 1, brightness);
            return [g, r, b];
        }).flat();
        return this.padFrame(data);
    }

    async smoothFade(length: number, offset: number, brightness: number, hueColor: number): Promise<Uint8Array> {
        const fadeDuration = 170;
        const half = fadeDuration / 2;
        const [r, g, b] = hsvToRgb(hueColor, 1, brightness);

        const computeIntensity = (color: number, offs: number) => {
            const t = offs % fadeDuration;
            return t < half
                ? Math.min(255, Math.round((color * t) / half))
                : Math.max(0, Math.round(color * (1 - (t - half) / half)));
        };

        const [ri, gi, bi] = [
            computeIntensity(r, offset),
            computeIntensity(g, offset),
            computeIntensity(b, offset),
        ];

        const data = createColorArray(length, () => [gi, ri, bi]).flat();
        return this.padFrame(data);
    }

    async fillColor(length: number, brightness: number, hueColor: number): Promise<Uint8Array> {
        const [r, g, b] = hsvToRgb(hueColor, 1, brightness); // значения 0..255

        const frame = new Uint8Array(length * 3);
        for (let i = 0; i < length; i++) {
            const off = i * 3;
            frame[off + 0] = g; // порядок GRB
            frame[off + 1] = r;
            frame[off + 2] = b;
        }

        return frame;
    }


    async off(length: number): Promise<Uint8Array> {
        return new Uint8Array(length * 3); // все нули
    }



    async soundBars(length: number, offset: number, brightness: number): Promise<Uint8Array> {
        const spectrum = getAudioSpectrum();

        // Сглаживание самих спектров (чтобы не прыгали)
        this.smoothed.bass   = this.smoothValue(spectrum.bass,   this.smoothed.bass);
        this.smoothed.mid    = this.smoothValue(spectrum.mid,    this.smoothed.mid);
        this.smoothed.treble = this.smoothValue(spectrum.treble, this.smoothed.treble);

        const bands = [
            { value: this.smoothed.bass * 0.8,   hueBase: 0   },   // красный
            { value: this.smoothed.mid,    hueBase: 120 },   // зелёный
            { value: this.smoothed.treble, hueBase: 240 },   // синий
        ];

        const segment = Math.floor(length / bands.length);
        const fallSpeed = 1; // скорость падения (пикселей за кадр)
        const riseSpeed = 0.5; // интерполяция при росте (0..1)

        const data: number[] = [];

        bands.forEach((band, idx) => {
            const start = idx * segment;
            const end = (idx === bands.length - 1) ? length : start + segment;

            const targetHeight = Math.floor((end - start) * Math.min(1, band.value));

            let current = this.barLevels[idx];

            if (targetHeight > current) {
                current = current + (targetHeight - current) * riseSpeed;
            } else if (targetHeight < current) {
                current = Math.max(0, current - fallSpeed);
            }

            this.barLevels[idx] = current;

            const barHeight = Math.floor(current);

            for (let i = start; i < end; i++) {
                const pos = i - start;
                let v = pos < barHeight ? 1 : 0;

                if (pos >= barHeight && pos < barHeight + 2) {
                    v = brightness;
                }

                const hue = (band.hueBase + offset * 2 + pos * 3) % 360;
                const [r, g, b] = hsvToRgb(hue, 1, v);

                data.push(g, r, b);
            }
        });

        return this.padFrame(data);
    }


    getEffectByName(effectName: string):
        ((length: number, brightness: number, offset?: number, hueColor?: number) => Promise<Uint8Array>) | undefined {
        const map = {
            rainbow: (length: number, offset = 0, brightness: number) => this.rainbow(length, offset, brightness),
            soundBars:   (length: number, offset = 0, brightness: number) => this.soundBars(length, offset, brightness),
            fillColor: (length: number, brightness: number, _offset?: number, hueColor = 0) => this.fillColor(length, brightness, hueColor),
            smoothFade: (length: number, offset = 0, brightness: number,  hueColor = 0) => this.smoothFade(length, brightness, offset, hueColor),
            off:       (length: number) => this.off(length),
        } as const;

        return (map as any)[effectName];
    }


    async findAll() {
        try {
            return await this.effectRepo.find();
        } catch (e) {
            throw new InternalServerErrorException(e, 'Эффекты не найдены');
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
            throw new NotFoundException(`Эффект с id ${id} не найден`);
        }
    }
}


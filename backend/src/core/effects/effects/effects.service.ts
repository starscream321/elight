import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {ArtnetService} from "../../artnet/artnet/artnet.service";
import {getAudioSpectrum} from "../../utils/audio.utils";
import {Effect} from "./effects.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";

@Injectable()
export class EffectsService {
    constructor(
        private readonly artnetService: ArtnetService,
        @InjectRepository(Effect)
        private effectRepo: Repository<Effect>,
    ) {}

    async sendRainbow(universe: number, ip: string, length: number, offset: number) {
        const array = createColorArray(length, i => {
            const hue = ((i + offset) % length) / length * 360;
            const [r, g, b] = hsvToRgb(hue, 1, 0.5);
            return [g, r, b]; // GRB
        });
        try {
            await this.artnetService.sendPacket(array, universe, ip);
            return { status: 'ok' }
        } catch (e) {
            throw new InternalServerErrorException(e)
        }
    }

    async sendSmoothFadeEffect(universe: number, ip: string, length: number, offset: number, hueColor: number) {
        const fadeDuration = 170;
        const half = fadeDuration / 2;
        const [r, g, b] = hsvToRgb(hueColor, 1, 1);

        const computeIntensity = (color: number, offset: number) => {
            const t = offset % fadeDuration;
            return t < half
                ? Math.min(255, Math.round(color * t / half))
                : Math.max(0, Math.round(color * (1 - (t - half) / half)));
        };

        const [ri, gi, bi] = [
            computeIntensity(r, offset),
            computeIntensity(g, offset),
            computeIntensity(b, offset),
        ];

        const array = createColorArray(length, () => [gi, ri, bi]);
        try {
            await this.artnetService.sendPacket(array, universe, ip);
        } catch (e) {
            throw new InternalServerErrorException(e)
        }
    }

    async sendFillColor(universe: number, ip: string, length: number, hueColor: number) {
        const [r, g, b] = hsvToRgb(hueColor, 1, 1);
        const array = createColorArray(length, () => [g, r, b]);

        try {
            await this.artnetService.sendPacket(array, universe, ip);
        } catch (e) {
            throw new InternalServerErrorException(e)
        }
    }

    async sendSoundPulse(universe: number, ip: string, length: number) {
        const { bass, mid, treble } = getAudioSpectrum();
        const max = Math.min(1, Math.max(bass, mid, treble) * 10);

        const array = createColorArray(length, i => {
            const hue = (i / length) * 360;
            const [r, g, b] = hsvToRgb(hue, 1, max);
            return [g, r, b];
        });

        try {
            await this.artnetService.sendPacket(array, universe, ip);
        } catch (e) {
            throw new InternalServerErrorException(e)
        }
    }

    getEffectByName(effectName: string): ((...args: any[]) => Promise<void>) | undefined {
        const map = {
            rainbow: this.sendRainbow.bind(this),
            fade: this.sendSmoothFadeEffect.bind(this),
            fillColor: this.sendFillColor.bind(this),
            sound: this.sendSoundPulse.bind(this),
        };

        return map[effectName];
    }


    async findAll() {
        try {
            return await this.effectRepo.find();
        } catch (e) {
            throw new InternalServerErrorException(e,'Эффекты не найдены');
        }
    }

}

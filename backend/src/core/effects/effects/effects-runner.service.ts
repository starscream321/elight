import { Injectable } from '@nestjs/common';
import { EffectsService } from './effects.service';
import { ArtnetService } from '../../artnet/artnet/artnet.service';

const IP_ADDRESS = '192.168.6.11';
const TOTAL_DIODES = 10000;
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL); // 170

const totalUniverses = Math.ceil(TOTAL_DIODES / MAX_PIXELS_PER_UNIVERSE);

type EffectFn = (length: number, offset?: number, hueColor?: number) => Promise<Uint8Array>;

@Injectable()
export class EffectsRunnerService {
    constructor(
        private readonly effectsService: EffectsService,
        private readonly artnetService: ArtnetService,
    ) {}

    private offsets = Array.from({ length: totalUniverses }, () => 0);
    private ticker?: NodeJS.Timeout;
    private fps = 30;

    private lastTick = 0;
    private nextTick = 0;
    private fpsEMA = 0;

    private getEffect(effectName: string): EffectFn | undefined {
        return this.effectsService.getEffectByName(effectName) as EffectFn | undefined;
    }

    async start(effectName: string, hueColor?: number, fps = 30): Promise<boolean> {
        const effect = this.getEffect(effectName);
        if (!effect) return false;

        this.stop();

        this.fps = Math.max(5, Math.min(60, fps));
        this.lastTick = Date.now();
        this.nextTick = this.lastTick;

        const loop = async () => {
            const now = Date.now();
            const interval = 1000 / this.fps;

            if (now >= this.nextTick) {
                this.nextTick += interval;
                if (now - this.nextTick > interval) this.nextTick = now + interval;

                for (let universe = 0; universe < totalUniverses; universe++) {
                    const startPixel = universe * MAX_PIXELS_PER_UNIVERSE;
                    const remaining = TOTAL_DIODES - startPixel;
                    const length = Math.max(0, Math.min(MAX_PIXELS_PER_UNIVERSE, remaining));
                    if (length <= 0) continue;

                    this.offsets[universe] = (this.offsets[universe] + 1) % length;

                    try {
                        // 1. эффект формирует кадр
                        const frame = await effect(length, this.offsets[universe], hueColor);

                        // 2. Runner сам отправляет (Buffer!)
                        await this.artnetService.sendPacket(Buffer.from(frame), universe, IP_ADDRESS);
                    } catch (e) {
                        // console.error(`Effect error u${universe}:`, e);
                    }
                }

                // замер FPS
                const dt = now - this.lastTick;
                if (dt > 0) {
                    const inst = 1000 / dt;
                    this.fpsEMA = this.fpsEMA ? this.fpsEMA + (inst - this.fpsEMA) * 0.1 : inst;
                }
                this.lastTick = now;
            }

            this.ticker = setTimeout(loop, 1);
        };

        this.ticker = setTimeout(loop, 0);
        return true;
    }

    stop() {
        if (this.ticker) {
            clearTimeout(this.ticker);
            this.ticker = undefined;
        }
    }
}

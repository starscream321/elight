import { Injectable } from '@nestjs/common';
import { EffectsService } from './effects.service';

const IP_ADDRESS = '192.168.6.11';
const TOTAL_DIODES = 10000;
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);

const calculateTotalUniverses = (totalDiodes: number) =>
    Math.ceil(totalDiodes / MAX_PIXELS_PER_UNIVERSE);

@Injectable()
export class EffectsRunnerService {
    constructor(private readonly effectsService: EffectsService) {}

    private offsets = new Array(calculateTotalUniverses(TOTAL_DIODES)).fill(0);
    private animationFrame: NodeJS.Timeout | null = null;
    private fps = 30;

    async start(effectName: string, hueColor: number, fps: number): Promise<boolean> {
        if (!this.effectsService.getEffectByName(effectName)) return false;

        this.stop(); // остановить предыдущий

        this.fps = fps;

        const totalUniverses = calculateTotalUniverses(TOTAL_DIODES);

        const run = async () => {
            const promises: Promise<void>[] = [];

            const effectFn = this.effectsService.getEffectByName(effectName);
            if (!effectFn) {
                console.warn(`Unknown effect: ${effectName}`);
                return;
            }

            for (let universe = 0; universe < totalUniverses; universe++) {
                const length = MAX_PIXELS_PER_UNIVERSE;
                this.offsets[universe] = (this.offsets[universe] + 1) % length;

                promises.push(
                    effectFn(
                        universe,
                        IP_ADDRESS,
                        length,
                        this.offsets[universe],
                        hueColor,
                    )
                );
            }

            await Promise.all(promises);
            this.animationFrame = setTimeout(run, 1000 / this.fps);
        };

        await run();
        return true;
    }

    stop() {
        if (this.animationFrame) {
            clearTimeout(this.animationFrame);
            this.animationFrame = null;
        }
    }
}
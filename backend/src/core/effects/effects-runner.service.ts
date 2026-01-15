import { Injectable, Logger } from '@nestjs/common';
import { EffectsService } from './effects.service';
import { ArtnetService } from '../artnet/artnet.service';

const IP_ADDRESS = process.env.ARTNET_IP || '192.168.6.11';
const TOTAL_DIODES = parseInt(process.env.TOTAL_DIODES || '5000', 10);
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);
const totalUniverses = Math.ceil(TOTAL_DIODES / MAX_PIXELS_PER_UNIVERSE);

type EffectFn = (
    length: number,
    offset: number,
    brightness?: number,
    hueColor?: number
) => Promise<Uint8Array>;

@Injectable()
export class EffectsRunnerService {
    private readonly logger = new Logger(EffectsRunnerService.name);

    constructor(
        private readonly effectsService: EffectsService,
        private readonly artnetService: ArtnetService,
    ) {}

    private startTime = 0;
    private ticker?: NodeJS.Timeout;
    private isRunning = false;

    private currentEffect?: EffectFn;
    private currentBrightness = 1;
    private currentHue = 0;

    private fullFrame = new Uint8Array(TOTAL_DIODES * 3);
    private universeBuffers = Array.from(
        { length: totalUniverses },
        () => new Uint8Array(MAX_PIXELS_PER_UNIVERSE * 3)
    );

    private getEffect(effectName: string): EffectFn | undefined {
        return this.effectsService.getEffectByName(effectName) as EffectFn | undefined;
    }

    public updateBrightness(brightness: number) {
        this.currentBrightness = brightness;
    }

    public updateHue(color: number) {
        this.currentHue = color;
    }

    async start(effectName: string, brightness: number, hueColor = 0): Promise<boolean> {
        const effect = this.getEffect(effectName);
        if (!effect) return false;

        this.stop();
        this.effectsService.resetState();

        this.currentEffect = effect;
        this.currentBrightness = brightness;
        this.currentHue = hueColor;
        this.startTime = Date.now();
        this.isRunning = true;

        const loop = async () => {
            if (!this.isRunning || !this.currentEffect) return;

            try {
                const elapsedTime = Date.now() - this.startTime;

                const frameFull = await this.currentEffect(
                    TOTAL_DIODES,
                    elapsedTime,
                    this.currentBrightness,
                    this.currentHue
                );

                this.fullFrame.set(frameFull);

                for (let u = 0; u < totalUniverses; u++) {
                    const start = u * MAX_PIXELS_PER_UNIVERSE * 3;
                    const end = start + MAX_PIXELS_PER_UNIVERSE * 3;

                    const target = this.universeBuffers[u];
                    target.set(this.fullFrame.subarray(start, end));

                    await this.artnetService.sendPacket(target, u, IP_ADDRESS);
                }

                if (this.isRunning) {
                    this.ticker = setImmediate(loop);
                }
            } catch (error) {
                this.logger.error('Error in effects loop', (error as Error).stack);
                if (this.isRunning) {
                    this.ticker = setTimeout(loop, 100);
                }
            }
        };

        this.ticker = setImmediate(loop);
        return true;
    }

    public stop() {
        this.isRunning = false;
        if (this.ticker) {
            clearTimeout(this.ticker);
            clearImmediate(this.ticker);
            this.ticker = undefined;
        }
        this.currentEffect = undefined;
    }
}

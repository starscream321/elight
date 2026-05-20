import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EffectsService } from './effects.service';
import { ArtnetService } from '../artnet/artnet.service';

const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);

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
        private readonly config: ConfigService,
    ) {
        this.ipAddress = this.config.get<string>('ARTNET_IP') || '192.168.6.11';
        this.totalDiodes = this.getPositiveInt('TOTAL_DIODES', 5000);
        this.frameIntervalMs = 1000 / this.getPositiveInt('EFFECTS_FPS', 60);
        this.totalUniverses = Math.ceil(this.totalDiodes / MAX_PIXELS_PER_UNIVERSE);
        this.universeBuffers = Array.from(
            { length: this.totalUniverses },
            () => new Uint8Array(MAX_PIXELS_PER_UNIVERSE * CHANNELS_PER_PIXEL),
        );
    }

    private startTime = 0;
    private ticker?: NodeJS.Timeout;
    private isRunning = false;
    private runId = 0;

    private currentEffect?: EffectFn;
    private currentBrightness = 1;
    private currentHue = 0;

    private readonly ipAddress: string;
    private readonly totalDiodes: number;
    private readonly frameIntervalMs: number;
    private readonly totalUniverses: number;
    private readonly universeBuffers: Uint8Array[];

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
        const activeRunId = ++this.runId;

        const loop = async () => {
            if (!this.isRunning || activeRunId !== this.runId || !this.currentEffect) return;

            const frameStartedAt = Date.now();

            try {
                const elapsedTime = Date.now() - this.startTime;

                const frameFull = await this.currentEffect(
                    this.totalDiodes,
                    elapsedTime,
                    this.currentBrightness,
                    this.currentHue
                );

                for (let u = 0; u < this.totalUniverses; u++) {
                    const start = u * MAX_PIXELS_PER_UNIVERSE * CHANNELS_PER_PIXEL;
                    const end = Math.min(
                        start + MAX_PIXELS_PER_UNIVERSE * CHANNELS_PER_PIXEL,
                        frameFull.length,
                    );

                    const target = this.universeBuffers[u];
                    const chunk = frameFull.subarray(start, end);
                    if (chunk.length < target.length) {
                        target.fill(0);
                    }
                    target.set(chunk);

                    await this.artnetService.sendPacket(target, u, this.ipAddress);
                }

                if (this.isRunning && activeRunId === this.runId) {
                    const elapsed = Date.now() - frameStartedAt;
                    this.ticker = setTimeout(loop, Math.max(0, this.frameIntervalMs - elapsed));
                }
            } catch (error) {
                this.logger.error('Error in effects loop', (error as Error).stack);
                if (this.isRunning && activeRunId === this.runId) {
                    this.ticker = setTimeout(loop, 100);
                }
            }
        };

        this.ticker = setTimeout(loop, 0);
        return true;
    }

    public stop() {
        this.isRunning = false;
        this.runId++;
        if (this.ticker) {
            clearTimeout(this.ticker);
            this.ticker = undefined;
        }
        this.currentEffect = undefined;
    }

    private getPositiveInt(name: string, fallback: number) {
        const value = Number(this.config.get<string | number>(name) ?? fallback);
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
    }
}

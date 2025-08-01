import {
    Controller,
    Post,
    Body,
    HttpCode, Get,
} from '@nestjs/common';
import { EffectsRunnerService } from './effects-runner.service';
import { EffectsService } from "./effects.service";

@Controller('effects')
export class EffectsController {
    constructor(
        private readonly effectsRunner: EffectsRunnerService,
        private readonly effectService: EffectsService
    ) {}

    @HttpCode(200)
    @Post('start')
    async startEffect(
        @Body()
        body: {
            effect: 'rainbow' | 'fade' | 'fillColor' | 'sound';
            hueColor?: number;
            fps?: number;
        },
    ) {
        const { effect, hueColor = 0, fps = 30 } = body;

        await this.effectsRunner.start(effect, hueColor, fps);
    }

    @HttpCode(200)
    @Post('stop')
    async stopEffect() {
        this.effectsRunner.stop();
    }

    @HttpCode(200)
    @Get()
    findAll() {
        return this.effectService.findAll();
    }
}

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
    async startEffect(@Body() body: {
            id: number;
            effect: string;
            active: boolean
            hueColor?: number;
            fps?: number;
            brightness?: number;
        },
    ) {
        const { id, active, effect, hueColor, brightness = 0.5 } = body;
        console.log(body);

        await this.effectsRunner.start(effect, brightness, hueColor);
        await this.effectService.updateEffectStatus(id, active)
    }

    @HttpCode(200)
    @Get('stop')
    async stopEffect() {
        this.effectsRunner.stop();
    }

    @HttpCode(200)
    @Get()
    findAll() {
        return this.effectService.findAll();
    }
}

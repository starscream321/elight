import {
    Controller,
    Post,
    Body,
    HttpCode,
    Get,
    BadRequestException,
    NotFoundException,
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
            brightness?: number;
        },
    ) {
        const { id, active, effect, hueColor = 0, brightness = 0.5 } = body;

        // Validate input
        if (!effect || typeof effect !== 'string') {
            throw new BadRequestException('Effect name is required');
        }
        if (typeof brightness !== 'number' || brightness < 0 || brightness > 1) {
            throw new BadRequestException('Brightness must be between 0 and 1');
        }
        if (hueColor !== undefined && (typeof hueColor !== 'number' || hueColor < 0 || hueColor >= 360)) {
            throw new BadRequestException('Hue color must be between 0 and 360');
        }

        const started = await this.effectsRunner.start(effect, brightness, hueColor);

        if (!started) {
            throw new NotFoundException(`Effect '${effect}' not found`);
        }

        await this.effectService.updateEffectStatus(id, active);

        return { success: true, effect, brightness, hueColor };
    }

    @HttpCode(200)
    @Post('brightness')
    setBrightness(@Body() body: { brightness: number }) {
        const { brightness } = body;

        if (typeof brightness !== 'number' || brightness < 0 || brightness > 1) {
            throw new BadRequestException('Brightness must be between 0 and 1');
        }

        this.effectsRunner.updateBrightness(brightness);
        return { success: true, brightness };
    }

    @HttpCode(200)
    @Post('color')
    setColor(@Body() body: { color: number }) {
        const { color } = body;

        if (typeof color !== 'number' || color < 0 || color >= 360) {
            throw new BadRequestException('Color must be between 0 and 360');
        }

        this.effectsRunner.updateHue(color);
        return { success: true, color };
    }

    @HttpCode(200)
    @Post('stop')
    async stopEffect() {
        this.effectsRunner.stop();
        return { success: true };
    }

    @HttpCode(200)
    @Get()
    findAll() {
        return this.effectService.findAll();
    }
}

import {
    Controller,
    Post,
    Body,
    HttpCode,
    Get,
    NotFoundException,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { EffectsRunnerService } from './effects-runner.service';
import { EffectsService } from './effects.service';
import {
    StartEffectDto,
    SetBrightnessDto,
    SetColorDto,
    StopEffectDto,
} from './dto/effects.dto';

@Controller('effects')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EffectsController {
    constructor(
        private readonly effectsRunner: EffectsRunnerService,
        private readonly effectService: EffectsService,
    ) {}

    @HttpCode(200)
    @Post('start')
    async startEffect(@Body() body: StartEffectDto) {
        const { id, active, effect, color = 0, brightness = 0.5 } = body;

        if (active === false) {
            this.effectsRunner.stop();
            await this.effectService.updateEffectStatus(id, false);
            return { success: true, effect, brightness, color };
        }

        const started = await this.effectsRunner.start(effect, brightness, color);

        if (!started) {
            throw new NotFoundException(`Effect '${effect}' not found`);
        }

        await this.effectService.updateEffectStatus(id, active);

        return { success: true, effect, brightness, color };
    }

    @HttpCode(200)
    @Post('brightness')
    setBrightness(@Body() body: SetBrightnessDto) {
        const { brightness } = body;
        this.effectsRunner.updateBrightness(brightness);
        return { success: true, brightness };
    }

    @HttpCode(200)
    @Post('color')
    setColor(@Body() body: SetColorDto) {
        const { color } = body;
        this.effectsRunner.updateHue(color);
        return { success: true, color };
    }

    @HttpCode(200)
    @Post('stop')
    async stopEffect(@Body() body: StopEffectDto = {}) {
        this.effectsRunner.stop();
        if (body?.id != null) {
            await this.effectService.updateEffectStatus(body.id, false);
        }
        return { success: true };
    }

    @HttpCode(200)
    @Get()
    findAll() {
        return this.effectService.findAll();
    }
}

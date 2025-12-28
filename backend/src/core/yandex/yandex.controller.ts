import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Patch,
    Param,
    UsePipes,
    ValidationPipe,
    Logger
} from '@nestjs/common';
import { YandexService } from './yandex.service';
import {YandexLights, YandexScenarios} from './yandex.entity';
import {Light, Lights, Scenarios} from '../../types/light';
import {
    ControlSingleDto,
    ControlManyDto,
    CreateLightDto,
    UpdateActiveDto,
    ControlScenarioDto,
} from './dto/control.dto';


@Controller('yandex')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class YandexController {
    private readonly logger = new Logger(YandexController.name);
    constructor(private readonly yandexService: YandexService) {}


    @HttpCode(200)
    @Post('/controlDevice')
    async controlDevice(@Body() body: ControlSingleDto): Promise<Light> {
        const { id, on, brightness, temperature_k } = body;
        await this.yandexService.controlDevice(id, on, brightness, temperature_k);
        return { id, on, brightness, temperature_k };
    }


    @HttpCode(200)
    @Post('/controlDevices')
    async controlDevices(@Body() body: ControlManyDto): Promise<Lights> {
        const { ids, on, brightness, temperature_k } = body;
        if (!ids.length) {
            throw new BadRequestException('Поле "ids" не должно быть пустым');
        }
        await this.yandexService.controlDevices(ids, on, brightness, temperature_k);
        return { ids, on, brightness, temperature_k };
    }


    @HttpCode(200)
    @Post('/controlScenarios')
    async controlScenarios(@Body() body: ControlScenarioDto): Promise<Scenarios> {
        const { scenarios_id } = body;
        if (!scenarios_id.length) {
            throw new BadRequestException('Поле "id" не должно быть пустым');
        }
        await this.yandexService.controlScenarios(scenarios_id);
        return { scenarios_id };
    }


    @HttpCode(200)
    @Get('/allLights')
    async giveAllLights(): Promise<YandexLights[]> {
        return this.yandexService.findAllDevices();
    }

    @HttpCode(200)
    @Get('/allScenarios')
    async giveAllScenarios(): Promise<YandexScenarios[]> {
        return this.yandexService.findAllScenarios();
    }

    @Post('/createDevice')
    async createDevice(@Body() body: CreateLightDto): Promise<YandexLights> {
        return this.yandexService.createDevices(body as Partial<YandexLights>);
    }

    @Patch('/updateDevice/:id')
    async updateDeviceActive(
        @Param('id') id: string,
        @Body() body: UpdateActiveDto,
    ): Promise<{ id: string; active: boolean }> {
        const { active } = body;
        await this.yandexService.updateDevice(id, active);
        return { id, active };
    }
}



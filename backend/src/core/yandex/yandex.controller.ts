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
import { YandexLights } from './yandex.entity';
import { Light, Lights } from '../../types/light';
import {
    ControlSingleDto,
    ControlManyDto,
    CreateLightDto,
    UpdateActiveDto,
} from './dto/control.dto';

@Controller('yandex')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class YandexController {
    private readonly logger = new Logger(YandexController.name);
    constructor(private readonly yandexService: YandexService) {}


    @HttpCode(200)
    @Post('/controlGroup')
    async controlGroup(@Body() body: ControlSingleDto): Promise<Light> {
        const { id, on, brightness, temperature_k } = body;
        await this.yandexService.controlGroup(id, on, brightness, temperature_k);
        return { id, on, brightness, temperature_k };
    }

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
    @Post('/controlGroups')
    async controlGroups(@Body() body: ControlManyDto): Promise<Lights> {
        const { ids, on, brightness, temperature_k } = body;
        if (!ids.length) {
            throw new BadRequestException('Поле "ids" не должно быть пустым');
        }
        await this.yandexService.controlGroups(ids, on, brightness, temperature_k);
        return { ids, on, brightness, temperature_k };
    }


    @HttpCode(200)
    @Get('/allLights')
    async giveAllLights(): Promise<YandexLights[]> {
        return this.yandexService.findAll();
    }

    @Post('/createDevice')
    async createDevice(@Body() body: CreateLightDto): Promise<YandexLights> {
        return this.yandexService.create(body as Partial<YandexLights>);
    }

    @Patch('/updateDevice/:id')
    async updateDeviceActive(
        @Param('id') id: string,
        @Body() body: UpdateActiveDto,
    ): Promise<{ id: string; active: boolean }> {
        const { active } = body;
        await this.yandexService.updateZone(id, active);
        return { id, active };
    }
}



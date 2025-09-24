import {BadRequestException, Body, Controller, HttpCode, Post} from '@nestjs/common';
import {YandexService} from "./yandex.service";

@Controller('yandex')
export class YandexController {
   constructor(private readonly yandexService: YandexService) {}
    @HttpCode(200)
    @Post('/controlGroup')
     async controlGroup(
         @Body() body: {
             id: string,
             on: boolean,
             brightness?: number,
             temperature_k?: number
         }
    ): Promise<{ status: string, id: string, on: boolean, brightness?: number, temperature_k?: number }> {

       const {id, on, brightness, temperature_k} = body;

        if (!id || typeof on) {
            throw new BadRequestException('Поле "group" и "on" обязательны');
        }

       await this.yandexService.controlGroup(id, on, brightness, temperature_k);

       return { status: 'ok', id, on, brightness, temperature_k };
     }

    @HttpCode(200)
    @Post('/controlDevice')
    async controlDevice(
        @Body() body: {
            id: string,
            on: boolean,
            brightness?: number,
            temperature_k?: number,
        }
    ): Promise<{ status: string, id: string, on: boolean, brightness?: number, temperature_k?: number }> {

        const {id, on, brightness, temperature_k} = body;

        if (!id || typeof on) {
            throw new BadRequestException('Поле "device" и "on" обязательны');
        }

        await this.yandexService.controlDevice(id, on, brightness, temperature_k);

        return { status: 'ok', id, on, brightness, temperature_k };
    }

    @HttpCode(200)
    @Post('/controlDevice')
    async controlDevices(
        @Body() body: {
            ids: string[],
            on: boolean,
            brightness?: number,
            temperature_k?: number,
        }
    ): Promise<{ status: string, ids: string[], on: boolean, brightness?: number, temperature_k?: number }> {

        const { ids, brightness, on, temperature_k } = body;

        if (!ids || typeof on) {
            throw new BadRequestException('Поле "device" и "on" обязательны');
        }

        await this.yandexService.controlDevices(ids, on, brightness, temperature_k );

        return { status: 'ok', ids, on, brightness, temperature_k };
    }


    @HttpCode(200)
    @Post('/controlGroups')
    async controlGroups(
        @Body() body: {
            ids: string[],
            on: boolean,
            brightness?: number,
            temperature_k?: number
        }
    ): Promise<{ status: string, ids: string[], on: boolean, brightness?: number, temperature_k?: number }> {

        const {ids, on, brightness, temperature_k} = body;

        if (!ids || typeof on) {
            throw new BadRequestException('Поле "device" и "on" обязательны');
        }

        await this.yandexService.controlGroups(ids, on, brightness, temperature_k);

        return { status: 'ok', ids, on, brightness, temperature_k };
    }

}

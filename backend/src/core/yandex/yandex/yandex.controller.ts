import {BadRequestException, Body, Controller, HttpCode, Post} from '@nestjs/common';
import {YandexService} from "./yandex.service";

@Controller('yandex')
export class YandexController {
   constructor(private readonly yandexService: YandexService) {}
    @HttpCode(200)
    @Post('/controlGroup')
     async controlGroup(
         @Body() body: {
             id: number,
             on: boolean,
             brightness?: number,
         }
    ): Promise<{ status: string, id: number, on: boolean, brightness?: number }> {

       const {id, on, brightness} = body;

        if (!id || typeof on) {
            throw new BadRequestException('Поле "group" и "on" обязательны');
        }

       await this.yandexService.controlGroup(id, on, brightness);

       return { status: 'ok', id, on, brightness };
     }

    @HttpCode(200)
    @Post('/controlDevice')
    async controlDevice(
        @Body() body: {
            id: number,
            on: boolean,
            brightness?: number,
        }
    ): Promise<{ status: string, id: number, on: boolean, brightness?: number }> {

        const {id, on, brightness} = body;

        if (!id || typeof on) {
            throw new BadRequestException('Поле "device" и "on" обязательны');
        }

        await this.yandexService.controlDevice(id, on, brightness);

        return { status: 'ok', id, on, brightness };
    }
}

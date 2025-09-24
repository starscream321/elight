import { Module } from '@nestjs/common';
import { YandexController } from './yandex.controller';
import { YandexService } from './yandex.service';
import {HttpModule} from "@nestjs/axios";
import {ZoneModule} from "../../../zone/zone.module";

@Module({
  imports: [HttpModule, ZoneModule],
  controllers: [YandexController],
  providers: [YandexService]
})
export class YandexModule {}

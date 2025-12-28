import { Module } from '@nestjs/common';
import { YandexController } from './yandex.controller';
import { YandexService } from './yandex.service';
import {HttpModule} from "@nestjs/axios";
import {TypeOrmModule} from "@nestjs/typeorm";
import {YandexLights, YandexScenarios} from "./yandex.entity";

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([YandexLights, YandexScenarios])],
  controllers: [YandexController],
  providers: [YandexService]
})
export class YandexModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {ArtnetModule} from "./core/artnet/artnet/artnet.module";
import {EffectsModule} from "./core/effects/effects/effects.module";
import {YandexModule} from "./core/yandex/yandex/yandex.module";
import {ZoneModule} from "./zone/zone.module";


@Module({
  imports: [
      TypeOrmModule.forRoot({
          type: 'sqlite',
          database: 'data.sqlite',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
      }),
      ArtnetModule,
      EffectsModule,
      YandexModule,
      ZoneModule
  ],
})
export class AppModule {}

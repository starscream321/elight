import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {ArtnetModule} from "./core/artnet/artnet/artnet.module";
import {EffectsModule} from "./core/effects/effects/effects.module";
import {YandexModule} from "./core/yandex/yandex.module";


@Module({
  imports: [
      ConfigModule.forRoot({
          isGlobal: true, // чтобы .env был доступен во всех модулях
      }),
      TypeOrmModule.forRoot({
          type: 'sqlite',
          database: 'data.sqlite',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
      }),
      ArtnetModule,
      EffectsModule,
      YandexModule
  ],
})
export class AppModule {}

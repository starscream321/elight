import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {ArtnetModule} from "./core/artnet/artnet.module";
import {EffectsModule} from "./core/effects/effects.module";
import {YandexModule} from "./core/yandex/yandex.module";
import {ApiKeyGuard} from "./guards/api-key.guard";


@Module({
  imports: [
      ConfigModule.forRoot({
          isGlobal: true,
      }),
      TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
              type: 'sqlite',
              database: 'data.sqlite',
              entities: [__dirname + '/**/*.entity{.ts,.js}'],
              synchronize: config.get<string>('TYPEORM_SYNCHRONIZE') === 'true',
          }),
      }),
      ArtnetModule,
      EffectsModule,
      YandexModule
  ],
  providers: [ApiKeyGuard],
})
export class AppModule {}

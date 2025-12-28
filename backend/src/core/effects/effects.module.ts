import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // 👈 Добавить
import { EffectsService } from './effects.service';
import { EffectsController } from './effects.controller';
import { ArtnetModule } from '../artnet/artnet.module';
import { Effect } from './effects.entity';
import {EffectsRunnerService} from "./effects-runner.service"; // 👈 Добавить

@Module({
  imports: [
    ArtnetModule,
    TypeOrmModule.forFeature([Effect])
  ],
  providers: [EffectsService, EffectsRunnerService],
  controllers: [EffectsController]
})
export class EffectsModule {}

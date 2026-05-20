import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EffectsService } from './effects.service';
import { EffectsController } from './effects.controller';
import { ArtnetModule } from '../artnet/artnet.module';
import { Effect } from './effects.entity';
import { EffectsRunnerService } from './effects-runner.service';
import { AudioService } from './audio.service';

@Module({
  imports: [
    ArtnetModule,
    TypeOrmModule.forFeature([Effect])
  ],
  providers: [EffectsService, EffectsRunnerService, AudioService],
  controllers: [EffectsController]
})
export class EffectsModule {}

import { Module } from '@nestjs/common';
import { ArtnetService } from './artnet.service';

@Module({
  providers: [ArtnetService],
  exports: [ArtnetService]
})
export class ArtnetModule {}

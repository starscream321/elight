import { Module } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { ZoneController } from './zone.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Zone} from "./zone.entity";

@Module({
  imports: [
      TypeOrmModule.forFeature([Zone])
  ],
  providers: [ZoneService],
  controllers: [ZoneController]
})
export class ZoneModule {}

import { Controller, Get, Post, Body } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { Zone } from './zone.entity';

@Controller('zones')
export class ZoneController {
    constructor(private readonly zoneService: ZoneService) {}

    @Get()
    findAll() {
        return this.zoneService.findAll();
    }

    @Post()
    create(@Body() zone: Partial<Zone>) {
        return this.zoneService.create(zone);
    }
}

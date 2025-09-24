import {Controller, Get, Post, Body, Put} from '@nestjs/common';
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

    @Put()
    updateZone(@Body() body: {
        name: string,
        active: boolean
    } ) {
        return this.zoneService.updateZone(body.name, body.active);
    }
}

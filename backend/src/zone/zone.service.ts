import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from './zone.entity';

@Injectable()
export class ZoneService {
    constructor(
        @InjectRepository(Zone)
        private zoneRepo: Repository<Zone>,
    ) {}

    findAll() {
        return this.zoneRepo.find();
    }

    updateZone(id: string, active: boolean) {
        return this.zoneRepo.update(
            { id },
            { active }
        );
    }

    create(zone: Partial<Zone>) {
        const newZone = this.zoneRepo.create(zone);
        return this.zoneRepo.save(newZone);
    }
}

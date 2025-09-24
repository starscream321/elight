import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {ZoneService} from "../../../zone/zone.service";

@Injectable()
export class YandexService {
    private readonly apiUrl = 'https://api.iot.yandex.net/v1.0';

    constructor(
        private readonly http: HttpService,
        private readonly zoneService: ZoneService
    ) {}

    private async sendApi(targetType: 'device' | 'groups', id: string, actions: any[] = []): Promise<void> {
        this.http.post(`${this.apiUrl}/${targetType}/${id}/actions`, actions, {
            headers: { Authorization: `Bearer ${process.env.YANDEX_TOKEN}` }
        })
    }

    async controlDevice(id: string, on: boolean, brightness?: number, temperature_k?: number): Promise<void> {
        const actions: any[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on }
            }
        ];

        if (brightness) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness }
            });
        } else if (temperature_k) {
            actions.push({
                type: 'devices.capabilities.color_setting',
                state: { instance: 'temperature_k', value: temperature_k }
            });
        }
        await this.zoneService.updateZone(id, on);

        await this.sendApi('device', id, actions);
    }

    async controlGroup(id: string, on: boolean, brightness?: number, temperature_k?: number): Promise<void> {
        const actions: any[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on }
            }
        ];

        if (brightness) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness }
            });
        } else if (temperature_k) {
            actions.push({
                type: 'devices.capabilities.color_setting',
                state: { instance: 'temperature_k', value: temperature_k }
            });
        }

        await this.sendApi('groups', id, actions);
    }

    async controlBrightness (id: string, brightness: number): Promise<void> {
        const actions: any[] = [
            {
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness }
            }
        ];

        await this.sendApi('device', id, actions);
    }

    async controlDevices(ids: string[], on: boolean, brightness?: number, temperature_k?: number): Promise<void> {
        await Promise.all(ids.map(id => this.controlDevice(id, on, brightness, temperature_k)));
    }

    async controlGroups(ids: string[], on: boolean, brightness?: number, temperature_k?: number): Promise<void> {
        await Promise.all(ids.map(id => this.controlGroup(id, on, brightness, temperature_k)));
    }


}

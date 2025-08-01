import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class YandexService {
    private readonly apiUrl = 'https://api.iot.yandex.net/v1.0';

    constructor(private readonly http: HttpService) {}

    private async sendApi(targetType: 'device' | 'groups', id: number, actions: any[] = []): Promise<void> {
        this.http.post(`${this.apiUrl}/${targetType}/${id}/actions`, actions, {
            headers: { Authorization: `Bearer ${process.env.YANDEX_TOKEN}` }
        })
    }

    async controlDevice(id: number, on: boolean, brightness?: number): Promise<void> {
        const actions: any[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on }
            }
        ];

        if (brightness !== undefined) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness }
            });
        }

        await this.sendApi('device', id, actions);
    }

    async controlGroup(id: number, on: boolean, brightness?: number): Promise<void> {
        const actions: any[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on }
            }
        ];

        if (brightness !== undefined) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness }
            });
        }

        await this.sendApi('groups', id, actions);
    }
}

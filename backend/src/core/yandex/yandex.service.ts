import {
    Injectable,
    InternalServerErrorException,
    BadGatewayException,
    ServiceUnavailableException,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { YandexLights } from './yandex.entity';

type TargetType = 'device' | 'groups';

interface YandexAction {
    type:
        | 'devices.capabilities.on_off'
        | 'devices.capabilities.range'
        | 'devices.capabilities.color_setting';
    state: {
        instance: 'on' | 'brightness' | 'temperature_k';
        value: boolean | number;
    };
}

@Injectable()
export class YandexService {
    private readonly apiUrl = 'https://api.iot.yandex.net/v1.0';
    private readonly logger = new Logger(YandexService.name);

    constructor(
        private readonly http: HttpService,
        @InjectRepository(YandexLights)
        private readonly yandexRepo: Repository<YandexLights>,
    ) {}

    private async sendApi(
        targetType: TargetType,
        id: string,
        actions: YandexAction[] = [],
    ): Promise<void> {
        const token = process.env.YANDEX_TOKEN;
        if (!token) {
            this.logger.error('YANDEX_TOKEN не задан в окружении');
            throw new InternalServerErrorException('Отсутствует токен для Yandex API');
        }

        try {
            await lastValueFrom(
                this.http.post(
                    `${this.apiUrl}/${targetType}/${id}/actions`,
                    { actions },
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 10_000,
                    },
                ),
            );
        } catch (err) {
            const e = err as AxiosError<any>;
            this.logger.error(
                `Ошибка запроса к Yandex API [${targetType}/${id}]`,
                e.stack || String(e),
            );

            if (e.response) {
                const status = e.response.status;
                const msg =
                    (e.response.data && (e.response.data.message || e.response.data.error)) ||
                    e.message;

                if (status >= 400 && status < 500) {
                    throw new BadGatewayException(
                        `Yandex API отклонил запрос (${status}): ${msg}`,
                    );
                }

                if (status >= 500) {
                    throw new ServiceUnavailableException(
                        `Yandex API недоступен (${status}): ${msg}`,
                    );
                }
            }

            throw new ServiceUnavailableException(`Не удалось связаться с Yandex API: ${e.message}`);
        }
    }

    async updateZone(id: string, active: boolean): Promise<void> {
        try {
            const res: UpdateResult = await this.yandexRepo.update({ id }, { active });
            if (!res.affected) {
                throw new NotFoundException(`Устройство с id "${id}" не найдено`);
            }
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            this.logger.error(`Ошибка обновления устройства ${id} в БД`, (e as Error).stack);
            throw new InternalServerErrorException('Ошибка обновления устройства');
        }
    }

    private validateLightParams(brightness?: number, temperature_k?: number): void {
        if (brightness !== undefined && Number.isNaN(brightness)) {
            throw new BadRequestException('brightness должен быть числом');
        }
        if (
            temperature_k !== undefined &&
            Number.isNaN(temperature_k)
        ) {
            throw new BadRequestException('temperature_k должен быть числом');
        }
    }


    findAll(): Promise<YandexLights[]> {
        return this.yandexRepo.find();
    }

    async create(zone: Partial<YandexLights>): Promise<YandexLights> {
        try {
            const entity = this.yandexRepo.create(zone);
            return await this.yandexRepo.save(entity);
        } catch (e) {
            this.logger.error('Ошибка создания устройства', (e as Error).stack);
            throw new InternalServerErrorException('Ошибка создания устройства');
        }
    }


    async controlDevice(
        id: string,
        on: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {
        this.validateLightParams(brightness, temperature_k);

        const actions: YandexAction[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on },
            },
        ];


        if (brightness !== undefined) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness },
            });
        }

        if (temperature_k !== undefined) {
            actions.push({
                type: 'devices.capabilities.color_setting',
                state: { instance: 'temperature_k', value: temperature_k },
            });
        }

        // Сначала обновим локальное состояние в БД (чтобы UI быстрее отражал изменения)
        await this.updateZone(id, on);

        // Затем отправим команду во внешний API
        await this.sendApi('device', id, actions);
    }

    async controlGroup(
        id: string,
        on: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {
        this.validateLightParams(brightness, temperature_k);

        const actions: YandexAction[] = [
            {
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: on },
            },
        ];

        if (brightness !== undefined) {
            actions.push({
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness },
            });
        }

        if (temperature_k !== undefined) {
            actions.push({
                type: 'devices.capabilities.color_setting',
                state: { instance: 'temperature_k', value: temperature_k },
            });
        }

        await this.sendApi('groups', id, actions);
    }

    async controlBrightness(id: string, brightness: number): Promise<void> {
        this.validateLightParams(brightness);

        const actions: YandexAction[] = [
            {
                type: 'devices.capabilities.range',
                state: { instance: 'brightness', value: brightness },
            },
        ];

        await this.sendApi('device', id, actions);
    }


    async controlDevices(
        ids: string[],
        on: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {
        const results = await Promise.allSettled(
            ids.map((id) => this.controlDevice(id, on, brightness, temperature_k)),
        );

        const errors = results
            .map((r, i) => ({ r, id: ids[i] }))
            .filter((x) => x.r.status === 'rejected') as { r: PromiseRejectedResult; id: string }[];

        if (errors.length) {
            const details = errors
                .map((e) => `${e.id}: ${(e.r.reason as Error)?.message || 'unknown error'}`)
                .join('; ');
            throw new BadGatewayException(`Ошибки при управлении устройствами: ${details}`);
        }
    }

    async controlGroups(
        ids: string[],
        on: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {
        const results = await Promise.allSettled(
            ids.map((id) => this.controlGroup(id, on, brightness, temperature_k)),
        );

        const errors = results
            .map((r, i) => ({ r, id: ids[i] }))
            .filter((x) => x.r.status === 'rejected') as { r: PromiseRejectedResult; id: string }[];

        if (errors.length) {
            const details = errors
                .map((e) => `${e.id}: ${(e.r.reason as Error)?.message || 'unknown error'}`)
                .join('; ');
            throw new BadGatewayException(`Ошибки при управлении группами: ${details}`);
        }
    }
}

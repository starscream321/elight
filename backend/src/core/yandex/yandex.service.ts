import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {HttpService} from '@nestjs/axios';
import {InjectRepository} from '@nestjs/typeorm';
import {In, Repository, UpdateResult} from 'typeorm';
import {AxiosError, AxiosResponse} from 'axios';
import {lastValueFrom} from 'rxjs';
import {YandexLights, YandexScenarios} from './yandex.entity';
import {actionBrightness, actionOnOff, actionTemperatureK, YandexAction} from "./types/yandex.actions";

type TargetType = 'devices' | 'scenarios';


@Injectable()
export class YandexService {
    private readonly apiUrl = 'https://api.iot.yandex.net/v1.0';
    private readonly logger = new Logger(YandexService.name);

    constructor(
        private readonly http: HttpService,
        @InjectRepository(YandexLights)
        private readonly yandexRepo: Repository<YandexLights>,
        @InjectRepository(YandexScenarios)
        private readonly yandexScenariosRepo: Repository<YandexScenarios>,
        private readonly config: ConfigService,
    ) {
    }


    private async sendApi(params:{
      targetType: TargetType,
      id?: string | string[],
      actions?: YandexAction[],
      scenarios_id?: string,}
    ): Promise<void> {
        const { targetType, id, actions, scenarios_id } = params
        let response: AxiosResponse;
        const token = this.config.get<string>('YANDEX_TOKEN');
        if (!token) {
            this.logger.error('YANDEX_TOKEN не задан в окружении');
            throw new InternalServerErrorException('Отсутствует токен для Yandex API');
        }

        try {
            if (targetType === 'devices') {
                const ids = Array.isArray(id) ? id : id ? [id] : [];
                if (!ids.length) {
                    throw new BadRequestException('Не переданы устройства для Yandex API');
                }

                const devices = ids.map((deviceId) => ({
                    id: deviceId,
                    actions,
                }));

                response = await lastValueFrom(
                    this.http.post(
                        `${this.apiUrl}/${targetType}/actions`,
                        {
                            [targetType]: devices,
                        },
                        {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 10_000,
                        },
                    ),
                );
            } else {
                response = await lastValueFrom(
                    this.http.post(
                        `${this.apiUrl}/${targetType}/${scenarios_id}/actions`,
                        {},
                        {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 10_000,
                        },
                    )
                )
            }
            this.logger.log(
                `Ответ Yandex API [${targetType}/${id || scenarios_id}]: ${JSON.stringify(response.data, null, 2)}`,
            );
            this.assertYandexResponseSuccess(response.data);
        } catch (err) {
            if (
                err instanceof BadRequestException ||
                err instanceof BadGatewayException ||
                err instanceof ServiceUnavailableException ||
                err instanceof InternalServerErrorException
            ) {
                throw err;
            }

            const e = err as AxiosError<Record<string, unknown>>;
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

    private assertYandexResponseSuccess(data: unknown) {
        const failures = this.collectYandexFailures(data);
        if (!failures.length) return;

        throw new BadGatewayException(`Yandex API вернул ошибки: ${failures.join('; ')}`);
    }

    private collectYandexFailures(value: unknown, path = 'response'): string[] {
        if (!value || typeof value !== 'object') return [];

        if (Array.isArray(value)) {
            return value.flatMap((item, index) => this.collectYandexFailures(item, `${path}[${index}]`));
        }

        const record = value as Record<string, unknown>;
        const status = record.status;
        const failures: string[] = [];

        if (typeof status === 'string' && !this.isSuccessfulYandexStatus(status)) {
            const message = this.getYandexErrorMessage(record);
            failures.push(`${path}: ${status}${message ? ` (${message})` : ''}`);
        }

        for (const [key, nested] of Object.entries(record)) {
            if (nested && typeof nested === 'object') {
                failures.push(...this.collectYandexFailures(nested, `${path}.${key}`));
            }
        }

        return failures;
    }

    private isSuccessfulYandexStatus(status: string) {
        return ['DONE', 'SUCCESS', 'OK'].includes(status.toUpperCase());
    }

    private getYandexErrorMessage(record: Record<string, unknown>) {
        const error = record.error;
        if (typeof error === 'string') return error;

        if (error && typeof error === 'object') {
            const errorRecord = error as Record<string, unknown>;
            const message = errorRecord.message || errorRecord.error || errorRecord.code;
            return typeof message === 'string' ? message : undefined;
        }

        const message = record.message || record.error_message;
        return typeof message === 'string' ? message : undefined;
    }

    private buildDeviceActions(
        on?: boolean,
        brightness?: number,
        temperature_k?: number,
    ): YandexAction[] {
        const actions: YandexAction[] = [];

        if (typeof on === 'boolean') {
            actions.push(actionOnOff(on));
        }
        if (typeof brightness === 'number') {
            actions.push(actionBrightness(brightness));
        }
        if (typeof temperature_k === 'number') {
            actions.push(actionTemperatureK(temperature_k));
        }

        if (actions.length === 0) {
            throw new BadRequestException('Не передано ни одного действия');
        }

        return actions;
    }

    async updateDevice(id: string, active?: boolean): Promise<void> {
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

    async findAllDevices(): Promise<YandexLights[]> {
        return await this.yandexRepo.find();
    }

    async findAllScenarios(): Promise<YandexScenarios[]> {
        return await this.yandexScenariosRepo.find();
    }

    async createDevices(zone: Partial<YandexLights>): Promise<YandexLights> {
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
        on?: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {

        const actions = this.buildDeviceActions(on, brightness, temperature_k);

        await this.sendApi({targetType:'devices', id: id, actions: actions});
        if (on !== undefined) {
            await this.updateDevice(id, on);
        }
    }

    async controlDevices(
        ids: string[],
        on?: boolean,
        brightness?: number,
        temperature_k?: number,
    ): Promise<void> {
        const actions = this.buildDeviceActions(on, brightness, temperature_k);

        await this.sendApi({targetType:'devices', id: ids, actions});

        if (on !== undefined) {
            const res = await this.yandexRepo.update({ id: In(ids) }, { active: on });
            if (!res.affected) {
                throw new NotFoundException('Устройства не найдены');
            }
        }
    }

    async controlScenarios(
        scenarios_id: string,
    ): Promise<void> {
        this.logger.log(`Запуск сценария ${scenarios_id}`);
        await this.sendApi({targetType:'scenarios', scenarios_id: scenarios_id});
    }
}

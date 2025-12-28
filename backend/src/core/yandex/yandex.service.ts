import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import {HttpService} from '@nestjs/axios';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, UpdateResult} from 'typeorm';
import {AxiosError} from 'axios';
import {lastValueFrom} from 'rxjs';
import {YandexLights, YandexScenarios} from './yandex.entity';
import * as process from "node:process";
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
    ) {
    }


    private async sendApi(params:{
      targetType: TargetType,
      id?: string,
      actions?: YandexAction[],
      scenarios_id?: string,}
    ): Promise<void> {
        const { targetType, id, actions, scenarios_id } = params
        let response;
        const token = process.env.YANDEX_TOKEN;
        if (!token) {
            this.logger.error('YANDEX_TOKEN не задан в окружении');
            throw new InternalServerErrorException('Отсутствует токен для Yandex API');
        }

        try {
            if (targetType === 'devices') {
                response = await lastValueFrom(
                    this.http.post(
                        `${this.apiUrl}/${targetType}/actions`,
                        {
                            [targetType]: [
                                {
                                    id,
                                    actions,
                                },
                            ],
                        },
                        {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 10_000,
                        },
                    ),
                );
            } else if (targetType === 'scenarios') {
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

        try {
            await this.sendApi({targetType:'devices', id: id, actions: actions});
            if (on !== undefined) {
                await this.updateDevice(id, on);
            }
        } catch (e) {

            throw e;
        }
    }

    async controlDevices(
        ids: string[],
        on?: boolean,
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

    async controlScenarios(
        scenarios_id: string,
    ): Promise<void> {
        console.log(scenarios_id);
        try {
            await this.sendApi({targetType:'scenarios', scenarios_id: scenarios_id});
        } catch (e) {
            throw e;
        }
    }
}

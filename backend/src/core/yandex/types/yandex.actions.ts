export type YandexAction =
    | {
    type: 'devices.capabilities.on_off';
    state: { instance: 'on'; value: boolean };
}
    | {
    type: 'devices.capabilities.range';
    state: { instance: 'brightness' | 'temperature_k'; value: number };
}
    | {
    type: 'devices.capabilities.color_setting';
    state: { instance: 'temperature_k'; value: number };
};

export const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

export const normalizeBrightness = (n: number) => clamp(Math.round(n), 1, 100);
export const normalizeTemperatureK = (n: number) => clamp(Math.round(n), 1500, 6500);

export const actionOnOff = (value: boolean): YandexAction => ({
    type: 'devices.capabilities.on_off',
    state: { instance: 'on', value },
});

export const actionBrightness = (value: number): YandexAction => ({
    type: 'devices.capabilities.range',
    state: { instance: 'brightness', value: normalizeBrightness(value) },
});

export const actionTemperatureK = (value: number): YandexAction => ({
    type: 'devices.capabilities.color_setting',
    state: { instance: 'temperature_k', value: normalizeTemperatureK(value) },
});

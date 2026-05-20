import type {EffectFromApi} from "../types/rgb.ts";
import { createApiClient } from "./client.ts";

const axiosInstance = createApiClient("effects");

const saveBrightness = (brightness: number) => {
    localStorage.setItem('rgb_brightness', JSON.stringify(brightness))
}

export const stopEffect = async (id?: number) => {
    const res = await axiosInstance.post('/stop', id != null ? { id } : {})
    return res.data
}

export const sendEffect = async (id: number, effect: string, brightness: number, active?: boolean, color?: number) => {
    saveBrightness(brightness)
    const newActive = active === undefined ? true : !active

    if (newActive === false) {
        const res = await stopEffect(id)
        return res
    }

    const res = await axiosInstance.post('/start', {
        id,
        effect,
        color,
        active: newActive,
        brightness
    })
    return res.data
}

export const setBrightness = async (brightness: number) => {
    saveBrightness(brightness)
    const res = await axiosInstance.post('/brightness', {
        brightness
    })
    return res.data;
}

export const setColor = async (color: number) => {
    const res = await axiosInstance.post('/color', {
        color
    })
    return res.data;
}

export const getEffects = async ():Promise<EffectFromApi[]> => {
    const res = await axiosInstance.get('/')
    return res.data;
}

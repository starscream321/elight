import axios from "axios";
import type {EffectFromApi} from "../types/rgb.ts";

const axiosInstance = axios.create({
    baseURL: 'http://192.168.11.78:3000/effects',
    headers: {
        'Content-Type': 'application/json',
    }
})

const saveBrightness = (brightness: number) => {
    localStorage.setItem('rgb_brightness', JSON.stringify(brightness))
}

export const sendEffect = async (id: number, effect: string, brightness: number, active?: boolean, color?: string) => {

    saveBrightness(brightness)
    const newActive = !active

    const res = await axiosInstance.post('/start', {
        id,
        effect,
        color,
        active: newActive,
        brightness
    })
    return res.data;
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
import axios from "axios";
import type {EffectFromApi} from "../types/rgb.ts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://192.168.11.78:3000'

const axiosInstance = axios.create({
    baseURL: `${apiBaseUrl}/effects`,
    headers: {
        'Content-Type': 'application/json',
    }
})

const saveBrightness = (brightness: number) => {
    localStorage.setItem('rgb_brightness', JSON.stringify(brightness))
}

export const sendEffect = async (id: number, effect: string, brightness: number, active?: boolean, hueColor?: number) => {

    saveBrightness(brightness)
    const newActive = !active

    const res = await axiosInstance.post('/start', {
        id,
        effect,
        hueColor,
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

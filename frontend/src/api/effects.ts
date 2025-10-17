import axios from "axios";
import type {EffectFromApi} from "../types/rgb.ts";

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/effects'
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

export const getEffects = async ():Promise<EffectFromApi[]> => {
    const res = await axiosInstance.get('/')
    return res.data;
}
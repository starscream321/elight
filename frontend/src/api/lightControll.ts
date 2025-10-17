import axios from "axios";
import debounce from "../utils/debounce.ts";
import type {ZoneFromApi} from "../types/zone.ts";

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/yandex'
})

export const saveBrightness = (brightness: number) => {
    localStorage.setItem('brightness', JSON.stringify(brightness))
}

export const fetchLights = async (): Promise<ZoneFromApi[]> => {
    const response = await axiosInstance.get("/allLights");
    return response.data
}

export const controlDevice = async (id: string, on?: boolean, brightness?: number, temperature_k?: number) => {
    const newOn = !on

    const response = await axiosInstance.post(`/controlDevice`, {
        id,
        on: newOn,
        brightness,
        temperature_k
    })
    return response.data;
}

export const sendBrightness = debounce(async (brightness: number, ids: string[]) => {
    saveBrightness(brightness);
    await axiosInstance.post('/controlDevices', { brightness, ids });
}, 300);

export const controlGroup = async (id: string, on: boolean, brightness?: number, temperature_k?: number) => {
    const response = await axiosInstance.post(`/controlGroup`, {
        id,
        on,
        brightness,
        temperature_k
    })

    return response.data;
}

export const controlDevices = async (ids: string[], on: boolean, brightness?: number, temperature_k?: number) => {

    const response = await axiosInstance.post(`/controlDevices`, {
        ids,
        on,
        brightness,
        temperature_k
    })
    return response.data;
}

export const controlGroups = async (ids: string[], on: boolean, brightness?: number, temperature_k?: number) => {
    const response = await axiosInstance.post(`/controlGroups`, {
        ids,
        on,
        brightness,
        temperature_k
    })

    return response.data;
}
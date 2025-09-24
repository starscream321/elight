import debounce from "../utils/debounce.ts";
import type {ZoneFromApi} from "../types/zone.ts";
import axios from "axios";

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api'
})

export const sendBrightness = debounce(async (brightness: number) => {
    await axiosInstance.post('/api/zones/brightness', {
        brightness
    })
}, 300)

export const fetchZones = async (): Promise<ZoneFromApi[]> => {
    const response = await axiosInstance.get("/api/zones");
    return response.data
}

export const updateZoneDevice = async (id: string, active: boolean) => {
    const newActive = !active;
    const response = await axiosInstance.post(`/api/zones`, {
        id: id,
        active: newActive
    });
    return response.data;
}
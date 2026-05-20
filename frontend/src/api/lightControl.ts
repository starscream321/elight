import debounce from "../utils/debounce.ts";
import type {ZoneFromApi} from "../types/zone.ts";
import type {ScenariosFromApi} from "../types/scenarios.ts";
import { createApiClient } from "./client.ts";

const axiosInstance = createApiClient("yandex");

export const saveBrightness = (brightness: number) => {
    localStorage.setItem('brightness', JSON.stringify(brightness))
}

export const fetchLights = async (): Promise<ZoneFromApi[]> => {
    try {
        const response = await axiosInstance.get("/allLights");
        return response.data;
    } catch (error) {
        console.error('Failed to fetch lights:', error);
        throw error;
    }
}

export const fetchScenarios = async (): Promise<ScenariosFromApi[]> => {
    try {
        const response = await axiosInstance.get("/allScenarios");
        return response.data;
    } catch (error) {
        console.error('Failed to fetch scenarios:', error);
        throw error;
    }
}

export const controlDevice = async (id: string, on?: boolean, brightness?: number, temperature_k?: number) => {
    try {
        const newOn = !on;

        const response = await axiosInstance.post(`/controlDevice`, {
            id,
            on: newOn,
            brightness,
            temperature_k
        });
        return response.data;
    } catch (error) {
        console.error('Failed to control device:', error);
        throw error;
    }
}

export const sendBrightness = debounce(async (brightness: number, ids: string[]) => {
    try {
        saveBrightness(brightness);
        await axiosInstance.post('/controlDevices', { brightness, ids });
    } catch (error) {
        console.error('Failed to send brightness:', error);
        throw error;
    }
}, 300);


export const controlScenarios = async (id: string) => {
    try {
        const response = await axiosInstance.post(`/controlScenarios`, {
            scenarios_id: id,
        });
        return response.data;
    } catch (error) {
        console.error('Failed to control scenarios:', error);
        throw error;
    }
}

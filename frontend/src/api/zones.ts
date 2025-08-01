import debounce from "../utils/debounce.ts";
import type {ZoneFromApi} from "../types/zone.ts";
import axios from "axios";

export const sendBrightness = debounce(async (brightness: number) => {
    await axios.post('/api/zones/brightness', {
        brightness
    })
}, 300)

export const fetchZones = async (): Promise<ZoneFromApi[]> => {
    const response = await axios.get("/api/zones");
    return response.data
}
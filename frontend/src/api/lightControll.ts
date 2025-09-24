import axios from "axios";

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api/yandex'
})

export const controlDevice = async (id: string, on: boolean, brightness?: number, temperature_k?: number) => {
    const newOn = !on

    const response = await axiosInstance.post(`/controlDevice`, {
        id,
        on: newOn,
        brightness,
        temperature_k
    })
    return response.data;
}

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
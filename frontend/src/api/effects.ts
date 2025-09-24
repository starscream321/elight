import axios from "axios";

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api'
})

export const sendEffect = async (effect: string) => {
    const res = await axiosInstance.get(`/effects/${effect}`)
    return res.data;
}
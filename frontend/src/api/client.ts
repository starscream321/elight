import axios, { AxiosError } from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.11.78:3000";

export const createApiClient = (scope: string) => {
    const client = axios.create({
        baseURL: `${API_BASE}/${scope}`,
        headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_API_KEY,
        },
    });

    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            const message =
                (error.response?.data as Record<string, unknown>)?.message ||
                error.message ||
                "Произошла ошибка при запросе";

            console.error("API Error:", message);
            return Promise.reject(error);
        },
    );

    return client;
};

interface Light {
    id: string,
    on?: boolean,
    brightness?: number,
    temperature_k?: number,
}

interface Lights {
    ids: string[],
    on?: boolean,
    brightness?: number,
    temperature_k?: number,
}

interface Scenarios {
    scenarios_id: string
}

export {Light, Lights, Scenarios}
export type IconLightsKey = 'tv' | 'table' | 'massage' | 'desktop' | 'ceiling' | 'entrance' | 'locker' | 'floor'


export interface ZoneFromApi {
    id: string
    name: string
    icon: IconLightsKey
    x: number
    y: number
    zone: 'top' | 'mid' | 'bot'
    active: boolean
}

import type { Component } from 'vue'

export interface ZoneFrontend extends Omit<ZoneFromApi, 'icon'> {
    icon: Component
}

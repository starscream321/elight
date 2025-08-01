
export type IconKey = 'tv' | 'table' | 'massage' | 'desktop' | 'ceiling' | 'entrance' | 'locker' | 'floor'

export interface ZoneFromApi {
    id: string
    name: string
    icon: IconKey
    x: number
    y: number
    zone: 'top' | 'center' | 'bottom'
    active: boolean
}

import type { Component } from 'vue'

export interface ZoneFrontend extends Omit<ZoneFromApi, 'icon'> {
    icon: Component
}

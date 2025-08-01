export type RgbIconKey = 'effectOff' | 'music' | 'pulse' | 'comet' | 'rainbow' | 'aurora'

export interface RgbFromApi {
    id: string
    name: string
    icon: RgbIconKey
    active: boolean
}

import type { Component } from 'vue'

export interface RgbFrontend extends Omit<RgbFromApi, 'icon'> {
    icon: Component
}
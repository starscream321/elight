export type IconEffectsKey = 'music' | 'pulse' | 'comet' | 'rainbow' | 'aurora' | 'effectsOff'

export interface EffectFromApi {
    id: number
    name: string
    effect: string
    icon: IconEffectsKey
    active: boolean
}

import type { Component } from 'vue'

export interface EffectFrontend extends Omit<EffectFromApi, 'icon'> {
    icon: Component
}
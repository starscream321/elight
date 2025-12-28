export type IconScenariosKey = 'lightness_max' | 'night' | 'default_light' | 'games' | 'party' | 'romance'

export interface ScenariosFromApi {
    id: string
    name: string
    icon: IconScenariosKey
}

import type { Component } from 'vue'

export interface ScenariosFrontend extends Omit<ScenariosFromApi, 'icon'> {
    icon: Component
}
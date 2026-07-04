<script setup lang="ts">
import AppSlider from "./AppSlider.vue";
import {computed, onMounted, ref, shallowRef, watch} from "vue";
import MainBtn from "./MainBtn.vue";
import debounce from "../utils/debounce.ts";
import ColorRing from "./ColorRing.vue";
import type {EffectFromApi, EffectFrontend} from "../types/rgb.ts";
import {getEffects, sendEffect, setBrightness, setColor} from "../api/effects.ts";
import { iconMapEffects } from "../icon/icons.ts";



const effects = shallowRef<EffectFrontend[]>([])
const brightness = ref(0)
const color = ref(0)
const isLoading = ref(false)
const MUSIC_EFFECT = 'music'
const isMusicEffect = (effect: string) => effect === MUSIC_EFFECT
const activeEffect = computed(() => effects.value.find((effect) => effect.active))
const isMusicActive = computed(() => activeEffect.value?.effect === MUSIC_EFFECT)

const getBrightnessFromLocalStorage = () => {
  const storageBrightness = localStorage.getItem('rgb_brightness')
  brightness.value = storageBrightness ? JSON.parse(storageBrightness) * 100 : 0;
}


const normalizeBrightness = (brightness: number) => brightness / 100


const fetchEffects = async () => {
  const data = await getEffects()
  effects.value = [...data.map((effect: EffectFromApi) => ({
    ...effect,
    icon: iconMapEffects[effect.icon],
  }))]
}



const handleControl = async (id: number, effect: string, brightness: number, color?: number, active?: boolean) => {
  if (isMusicEffect(effect)) return

  const previousEffects = effects.value;
  const nextActive = active === undefined ? true : !active;

  isLoading.value = true
  effects.value = effects.value.map((item) => ({
    ...item,
    active: nextActive && item.id === id,
  }))

  try {
    await sendEffect(id, effect, brightness, active, color)
  } catch (error) {
    effects.value = previousEffects;
    throw error;
  } finally {
    isLoading.value = false
  }
}


onMounted(async () => {
  getBrightnessFromLocalStorage()
  await fetchEffects()
})

const debouncedSetBrightness = debounce(async (newBrightness: number) => {
  await setBrightness(newBrightness / 100)
}, 200)

const debouncedSetColor = debounce(async (newColor: number) => {
  if (isMusicActive.value) return
  await setColor(newColor)
}, 200)

const handleBrightnessInput = (newBrightness: number) => {
  debouncedSetBrightness(newBrightness)
}

watch(color, (newColor) => {
  debouncedSetColor(newColor)
})



</script>

<template>
  <div
    class="rgb-container"
  >
    <div
      class="color-ring-shell"
      :class="{ 'color-ring-shell_disabled': isMusicActive }"
    >
      <ColorRing
        v-model="color"
      />
    </div>
    <div
      class="rgb-btn-container"
    >
      <MainBtn
          v-for="effect in effects"
          @click="handleControl(effect.id, effect.effect, normalizeBrightness(brightness), isMusicEffect(effect.effect) ? undefined : color, effect.active)"
          :key="effect.id"
          :name="effect.name"
          :icon="effect.icon"
          :active="!isMusicEffect(effect.effect) && effect.active"
          :disabled="isLoading || isMusicEffect(effect.effect)"
      />
    </div>
    <AppSlider
      v-model="brightness"
      @brightness-input="handleBrightnessInput"
    />
  </div>
</template>

<style scoped>
.rgb-container {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 54px;
}

.rgb-btn-container {
  display: grid;
  grid-template-columns: repeat(3, 183px);
  grid-auto-rows: 120px;
  gap: 8px;
}

.color-ring-shell {
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.color-ring-shell_disabled {
  opacity: 0.35;
  filter: grayscale(1);
  pointer-events: none;
}
</style>

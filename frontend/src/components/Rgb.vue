<script setup lang="ts">
import AppSlider from "./AppSlider.vue";
import {onMounted, ref, shallowRef, watch} from "vue";
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
  await setColor(newColor)
}, 200)

watch(brightness, (newBrightness) => {
  debouncedSetBrightness(newBrightness)
})

watch(color, (newColor) => {
  debouncedSetColor(newColor)
})



</script>

<template>
  <div
    class="rgb-container"
  >
    <ColorRing
      v-model="color"
    />
    <div
      class="rgb-btn-container"
    >
      <MainBtn
          v-for="effect in effects"
          @click="handleControl(effect.id, effect.effect, normalizeBrightness(brightness), color, effect.active)"
          :key="effect.id"
          :name="effect.name"
          :icon="effect.icon"
          :active="effect.active"
          :disabled="isLoading"
      />
    </div>
    <AppSlider
      v-model="brightness"
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
</style>

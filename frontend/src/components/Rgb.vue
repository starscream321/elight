<script setup lang="ts">
import AppSlider from "./AppSlider.vue";
import {onMounted, ref} from "vue";
import MainBtn from "./MainBtn.vue";

import AuroraIcon from '../assets/icons/aurora.svg'
import MusicIcon from '../assets/icons/music.svg'
import PulseIcon from '../assets/icons/pulse.svg'
import EffectOffIcon from '../assets/icons/effects-off.svg'
import CometIcon from '../assets/icons/comet.svg'
import RainbowIcon from '../assets/icons/rainbow.svg'
import ColorRing from "./ColorRing.vue";
import type { RgbIconKey, RgbFrontend, RgbFromApi } from "../types/rgb.ts";
import axios from "axios";




const brightness = ref(0)
const color = ref(null)

const iconMap: Record<RgbIconKey, String> = {
  effectOff: EffectOffIcon,
  comet: CometIcon,
  pulse: PulseIcon,
  rainbow: RainbowIcon,
  music: MusicIcon,
  aurora: AuroraIcon
}

const effects = ref<RgbFrontend[]>([])

onMounted(async () => {
  const res = await axios.get('/api/effect')
  effects.value = res.data.map((effect: RgbFromApi) => ({
    ...effect,
    icon: iconMap[effect.icon]
  }))
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
          :name="effect.name"
          :icon="effect.icon"
          :active="effect.active"
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
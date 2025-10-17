<script setup lang="ts">


import {computed, onMounted, ref, shallowRef, watch} from "vue";
import MainBtn from "./MainBtn.vue";
import AppSlider from "./AppSlider.vue";
import type {ZoneFromApi, ZoneFrontend} from "../types/zone.ts";
import {iconMapLights} from "../icon/icons.ts";
import {controlDevice, fetchLights, sendBrightness} from "../api/lightControll.ts";




const brightness = ref<number>(0)

const zones = shallowRef<ZoneFrontend[]>([])


const getBrightnessFromLocalStorage = () => {
  const storageBrightness = localStorage.getItem('brightness')
  brightness.value = storageBrightness ? JSON.parse(storageBrightness) : 0;
}


const updateZones = async () => {
  const data = await fetchLights()
  zones.value = [...data.map((zone: ZoneFromApi) => ({
    ...zone,
    icon: iconMapLights[zone.icon],
  }))]
}

const handleControl = async (id: string, active: boolean) => {
  await controlDevice(id, active)
  await updateZones()
}

onMounted(async () => {
  await updateZones()
  getBrightnessFromLocalStorage()
})

watch(brightness, (val: number) => {
  const activeIds = zones.value.filter(z => z.active).map(z => z.id);
  if (activeIds.length) {
    sendBrightness(val, activeIds);
  }
});

const topZones = computed(() => zones.value.filter(z => z.zone === 'top'))
const centerZones = computed(() => zones.value.filter(z => z.zone === 'mid'))
const bottomZones = computed(() => zones.value.filter(z => z.zone === 'bot'))
</script>

<template>
<div
  class="zones-container"
>
  <div class="left-right">
    <span>СЛЕВА</span>
    <span>СПРАВА</span>
  </div>
  <div
    class="zones-top"
  >
    <MainBtn
        v-for="btn in topZones"
        @click="handleControl(btn.id, btn.active)"
        :name="btn.name"
        :icon="btn.icon"
        :key="btn.id"
        :active="btn.active"
        :style="{
          gridColumn: btn.x,
          gridRow: btn.y,
        }"
    />
  </div>
  <div
    class="zones-center"
  >
    <MainBtn
        v-for="btn in centerZones"
        @click="handleControl(btn.id, btn.active)"
        :name="btn.name"
        :icon="btn.icon"
        :key="btn.id"
        :active="btn.active"
        :style="{
        gridColumn: btn.x,
        gridRow: btn.y,
      }"
    />
  </div>
  <div
    class="zones-bot"
  >
    <MainBtn
        v-for="btn in bottomZones"
        @click="handleControl(btn.id, btn.active)"
        :name="btn.name"
        :icon="btn.icon"
        :key="btn.id"
        :active="btn.active"
        :style="{
        gridColumn: btn.x,
        gridRow: btn.y,
      }"
    />
  </div>
  <AppSlider
    v-model="brightness"
  />
</div>
</template>

<style scoped>
  .zones-container {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    gap: 54px;
  }
  .zones-top {
    display: grid;
    grid-template-columns: repeat(2, 183px);
    grid-auto-rows: 120px;
    gap: 8px;
  }
  .zones-center {
    display: grid;
    grid-template-columns: repeat(4, 183px);
    grid-auto-rows: 120px;
    gap: 8px;
  }

  .zones-bot {
    display: grid;
    grid-template-columns: repeat(3, 183px);
    grid-auto-rows: 120px;
    gap: 8px;
  }

  .left-right {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 56px;
    position: absolute;
    top: 80px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    font-size: 20px;
    line-height: 24px;
    letter-spacing: 1px;
    text-align: center;
    text-transform: uppercase;

  }

</style>
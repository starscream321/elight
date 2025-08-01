<script setup lang="ts">



import {computed, onMounted, ref, watch} from "vue";
import MainBtn from "./MainBtn.vue";
import AppSlider from "./AppSlider.vue";
import type {ZoneFromApi, ZoneFrontend} from "../types/zone.ts";
import {fetchZones, sendBrightness} from "../api/zones.ts";
import {iconMap} from "../icons/icons.ts";




const brightness = ref(0)

const zones = ref<ZoneFrontend[]>([])


onMounted(async () => {
  const data = await fetchZones()
  zones.value = data.map((zone: ZoneFromApi) => ({
    ...zone,
    icon: iconMap[zone.icon],
  }))
})

watch(brightness, (newVal: number) => {
  sendBrightness(newVal)
})

const topZones = computed(() => zones.value.filter(z => z.zone === 'top'))
const centerZones = computed(() => zones.value.filter(z => z.zone === 'center'))
const bottomZones = computed(() => zones.value.filter(z => z.zone === 'bottom'))
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
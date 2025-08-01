<script setup lang="ts">

import {ref} from "vue";
import Scenarios from "../components/Scenarios.vue";
import Zones from "../components/Zones.vue";
import Rgb from "../components/Rgb.vue";


const switcher = ref(['Сценарии', 'Зоны', 'RGB'])

const activeBtn = ref('Сценарии')

const switchBtn = (btn: string) => {
  activeBtn.value = btn;
}

const isActive = (btn: string) => btn === activeBtn.value;

</script>

<template>
  <div class="container_scenarios">
    <div class="switcher">
      <button
          class="switcher_btn"
          v-for="btn in switcher"
          :key="btn"
          @click="switchBtn(btn)"
          :class="{ active: isActive(btn)}"
      >
        <span>{{btn}}</span>
      </button>
    </div>
    <Scenarios
      v-if="activeBtn === 'Сценарии'"
    />
    <Zones
      v-else-if="activeBtn === 'Зоны'"
    />
    <Rgb
      v-else-if="activeBtn === 'RGB'"
    />
  </div>
</template>

<style scoped>
  .container_scenarios {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 54px;
    padding: 32px;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 1);
    background-image: url("../assets/4 на 5 - Star VIP 7 1.png");
  }

  .switcher_btn {
    width: 100%;
    height: 60px;
    border-radius: 100px;
    border: none;
    color: rgba(255, 255, 255, 1);
    background-color: transparent;
  }

  .switcher_btn.active {
    width: 100%;
    border: 1px solid;
    color: rgba(0, 0, 0, 1);
    background: rgba(255, 255, 255, 0.8);
    border-image-source:
        linear-gradient(156.52deg, #FFFFFF 2.12%,
        rgba(255, 255, 255, 0.0001) 39%,
        rgba(255, 255, 255, 0.0001) 54.33%,
        rgba(255, 255, 255, 0.7) 93.02%);
  }

  .switcher {
    padding: 6px;
    width: 480px;
    height: 72px;
    background-color: rgba(128, 128, 128, 0.3);
    border-radius: 100px;
    border: 1px solid;
    border-image-source:
        linear-gradient(156.52deg, rgba(255, 255, 255, 0.4) 2.12%,
        rgba(255, 255, 255, 0.0001) 39%,
        rgba(255, 255, 255, 0.0001) 54.33%,
        rgba(255, 255, 255, 0.1) 93.02%);
    display: flex;
    align-items: center;
    flex-direction: row;
  }
</style>
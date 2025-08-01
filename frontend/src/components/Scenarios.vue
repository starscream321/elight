<script setup lang="ts">

import MainBtn from "./MainBtn.vue";
import Lightness_max_icon from "../assets/icons/lightness-max.svg";
import Night_icon from "../assets/icons/night.svg";
import Default_light_icon from "../assets/icons/default-light.svg";
import Games_icon from "../assets/icons/games.svg";
import Party_icon from "../assets/icons/party.svg";
import Romance_icon from "../assets/icons/romance.svg";


const buttons = [
  {
    name: "Яркий",
    icon: Lightness_max_icon,
    active: false
  },
  {
    name: "Ночной",
    icon: Night_icon,
    active: false
  },
  {
    name: "Стандарт",
    icon: Default_light_icon,
    active: false
  },
  {
    name: "Игры и кино",
    icon: Games_icon,
    active: false
  },
  {
    name: "Вечеринка",
    icon: Party_icon,
    active: false
  },
  {
    name: "Романтика",
    icon: Romance_icon,
    active: false
  }
]
</script>

<template>
  <div class="buttons-scenarios">
    <MainBtn
        v-for="btn in buttons"
        :key="btn.name"
        :name="btn.name"
        :icon="btn.icon"
        :active="btn.active"
    />
  </div>
</template>

<style scoped>
.buttons-scenarios {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
  width: 100%;
  height: 616px;
}
</style>
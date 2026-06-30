<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import LightnessMaxIcon from '../assets/icons/lightness-max.svg'
import KaraokeIcon from '../assets/icons/karaoke.svg'
import MassageIcon from '../assets/icons/massage.svg'

const links = [
  {
    name: 'Свет',
    link: '/',
    icon: LightnessMaxIcon
  },
  {
    name: 'Караоке',
    link: '/karaoke',
    icon: KaraokeIcon
  },
  {
    name: 'Массаж',
    link: '/massage',
    icon: MassageIcon
  }
]

const router = useRouter();
const route = useRoute();

const goTo = (path: string) => {
  router.push(path);
}

const isActive = (path: string) => route.path === path;
</script>

<template>
  <div class="container">
    <button
        v-for="btn in links"
        :key="btn.name"
        :class="{ active: isActive(btn.link) }"
        @click="goTo(btn.link)"
    >
      <component :is="btn.icon" />
      <span>{{ btn.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.container {
  position: absolute;
  z-index: 10;
  justify-content: space-between;
  display: flex;
  bottom: 0;
  width: 100%;
  height: 110px;
  backdrop-filter: blur(100px);
}

button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 1);
  background-color: rgba(128, 128, 128, 0.3);
  font-family: "SF Pro Rounded", sans-serif;
  font-weight: 500;
  font-size: 20px;
  border: none;
}

button svg {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
}

button.active {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid;
  border-image-source:
      linear-gradient(156.52deg,
      #FFFFFF 2.12%,
      rgba(255, 255, 255, 0.0001) 39%,
      rgba(255, 255, 255, 0.0001) 54.33%,
      rgba(255, 255, 255, 0.7) 93.02%);
  color: black;
}
</style>

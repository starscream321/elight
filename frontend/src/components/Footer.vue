<script setup lang="ts">

import {useRoute, useRouter} from "vue-router";


import LightnessMaxIcon from '../assets/icons/lightness-max.svg'
import KaraokeIcon from '../assets/icons/karaoke.svg'
import InfoIcon from '../assets/icons/instructions.svg'


const links = [
  {
    name: 'Освещение',
    link: '/',
    icon: LightnessMaxIcon
  },
  {
    name: 'Караоке',
    link: '/karaoke',
    icon: KaraokeIcon
  },
  {
    name: 'Информация',
    link: '/info',
    icon: InfoIcon
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
      <component
        :is="btn.icon"
      />
      <span>{{btn.name}}</span>
    </button>
  </div>
</template>

<style scoped>
  .container {
    position: absolute;
    justify-content: space-between;
    display: flex;
    bottom: 0;
    width: 100%;
    height: 110px;
    backdrop-filter: blur(100);
  }
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 1) ;
    background-color: rgba(128, 128, 128, 0.3);
    font-weight: 500;
    font-size: 20px;
    border: none;
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
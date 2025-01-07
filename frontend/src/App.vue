<template>
  <div class="box">
    <AppButton
      v-for="effect in fadeEffects"
      :name="effect.name"
      @click="setEffect('fade', effect.color)"
    />
    <AppButton
      v-for="effect in staticEffects"
      :name="effect.name"
      @click="setEffect('fillColor', effect.color)"
    />
    <AppButton
      v-for="effect in effects"
      :name="effect.name"
      @click="setEffect(effect.effect)"
    />
    <AppButton
      name="OFF"
      @click="offLed"
    />
  </div>
</template>

<script setup>
import AppButton from '@/components/AppButton.vue'
import axios from 'axios'

const URL = 'http://192.168.6.10:3001'

const fadeEffects = [
  {
    name: 'Синий',
    color: '240'
  },
  {
    name: 'Красный',
    color: 0,
  },
  {
    name: 'Пурпурный',
    color: 300,
  },
  {
    name: 'Золотой',
    color: '65'
  }
]

const staticEffects = [
  {
    name: 'Синий',
    color: '240'
  },
  {
    name: 'Красный',
    color: 0,
  },
  {
    name: 'Пурпурный',
    color: 300,
  },
  {
    name: 'Золотой',
    color: '65'
  }
]

const effects = [
  {
    name: 'Радуга',
    effect: 'rainbow',
  },
  {
    name: 'Совесткая гирлянда',
    effect: 'soviet'
  },
  {
    name: 'Гирлянда',
    effect: 'garland'
  },
  {
    name: 'Разноцветный стробоскоп',
    effect: 'stroboTechno'
  }
]

const setEffect = async (effectName, color) => {
  try {
    const response = await axios.post(URL + '/set-effect',{
      effect: effectName,
      hueColor: color
    },)
  } catch (e) {
    console.log(e)
  }
}

const offLed = async () => {
  try {
    await axios.get(URL + '/off-led')
  } catch (e) {
    console.log(e)
  }
}

</script>

<style>
body {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
}
.box {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-flow: column wrap;
  background-color: black;
  width: 100%;
  height: 100vh;
}
</style>

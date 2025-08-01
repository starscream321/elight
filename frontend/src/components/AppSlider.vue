<script setup lang="ts">
import LightnessMaxIcon from '../assets/icons/lightness-max.svg'
import LightnessMinIcon from '../assets/icons/lightness-min.svg'


const brightness = defineModel()
</script>

<template>
  <div class="slider-wrapper">
    <LightnessMinIcon
        class="slider-icon"
    />
    <div class="slider-track">
      <div class="slider-fill" :style="{ width: brightness + '%' }"></div>
      <input
          type="range"
          min="0"
          max="100"
          v-model="brightness"
          class="slider-input"
      />
    </div>
    <LightnessMaxIcon
        class="slider-icon"
    />
  </div>
</template>

<style scoped>
.slider-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px;
  border-radius: 999px;
  gap: 10px;
}

.slider-icon {
  color: white;
}

.slider-track {
  position: relative;
  flex-grow: 1;
  height: 64px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 999px;
  overflow: hidden;
}

.slider-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #ccc;
  border-radius: 999px 0 0 999px;
  z-index: 1;
}

.slider-input {
  position: relative;
  width: 100%;
  height: 100%;
  appearance: none;
  background: transparent;
  z-index: 2;
  cursor: pointer;
}

/* Убираем видимый ползунок */
.slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 0;
  height: 0;
  background: transparent;
  box-shadow: none;
  border: none;
}

.slider-input::-moz-range-thumb {
  appearance: none;
  width: 0;
  height: 0;
  background: transparent;
  border: none;
}
</style>

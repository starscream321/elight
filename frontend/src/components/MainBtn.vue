<script setup lang="ts">
defineProps<{
  name: string,
  icon: any,
  active: boolean,
}>()


const isActive = (status: boolean) => status;
</script>

<template>
  <button
      class="main_btn"
      :class="{active: isActive(active)}"
  >
    <component
        :is="icon"
        v-if="icon"
        class="main_btn__icon"
    />
    <span>{{name}}</span>
  </button>
</template>

<style scoped>
.main_btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 24px;
  background: rgba(128, 128, 128, 0.3);
  background-blend-mode: luminosity;
  z-index: 0;
  padding: 20px;
  color: rgba(255, 255, 255, 1);
  font-size: 20px;
}

.main_btn::before {
  content: "";
  position: absolute;
  top: -1px; left: -1px; right: -1px; bottom: -1px;
  border-radius: 24px;
  padding: 1px;
  background: linear-gradient(156.52deg,
  rgba(255, 255, 255, 0.4) 2.12%,
  rgba(255, 255, 255, 0.0001) 39%,
  rgba(255, 255, 255, 0.0001) 54.33%,
  rgba(255, 255, 255, 0.1) 93.02%);
  -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
  pointer-events: none;
  z-index: -1;
}


.main_btn.active {
  background: rgba(255, 255, 255, 0.8);
  color: black;
}

</style>
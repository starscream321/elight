<script setup lang="ts">

const props = defineProps<{
  name: string,
  icon: any,
  active: boolean,
}>()

</script>

<template>
  <button
      class="main_btn"
      :class="{active: props.active}"
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
  font-family: "SF Pro Rounded", sans-serif;
  font-weight: 600;
  font-size: 20px;
  line-height: 24px;
  letter-spacing: 0.36px;

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
  border: 1px solid;
  border-image-source:
      linear-gradient(156.52deg, rgba(255, 255, 255, 0.4) 2.12%,
      rgba(255, 255, 255, 0.0001) 39%, rgba(255, 255, 255, 0.0001) 54.33%,
      rgba(255, 255, 255, 0.1) 93.02%);


}



.main_btn.active {
  background: rgba(255, 255, 255, 0.8);
  color: black;
}

</style>
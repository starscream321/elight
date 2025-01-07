<template>
  <button>
    {{props.name}}
  </button>
</template>

<script setup>
const props = defineProps({
  name: String
})
</script>

<style scoped>
button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;
  height: fit-content;
}
</style>

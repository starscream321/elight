<script setup lang="ts">
interface Props {
  image: string;
  qr: string;
  title?: string;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
});
</script>

<template>
  <div class="container">
    <div class="img_container">
      <img class="img" :src="props.image" alt="image" />
      <img class="qr" :src="props.qr" alt="qr" />
    </div>
    <div class="text_container">
      <button>asd</button>
      <p class="title">{{ props.title }}</p>
      <p class="description">{{ props.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.img_container {
  position: relative;
  width: 100%;
  height: fit-content;
  margin-bottom: 140px;
}
.img {
  margin: 0;
  padding: 0;
  width: 100%;
  height: auto;
  display: block;
}
.qr {
  position: absolute;
  left: 50%;
  transform: translate(-50%);
  bottom: -100px;
}
.text_container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.title {
  color: #ffffff;
  width: 100%;
  font-size: 42px;
  text-align: center;
  margin: 0;
}
.description {
  color: white;
  width: 600px;
  font-size: 24px;
  text-align: center;
  margin: 0;
}
</style>

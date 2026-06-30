<script setup lang="ts">
interface Props {
  image: string;
  qr: string;
  title?: string;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Видео-инструкция',
  description: '',
});
</script>

<template>
  <section class="instruction-screen">
    <div class="media">
      <img class="media__image" :src="props.image" alt="" />
      <img class="media__qr" :src="props.qr" alt="QR-код видео-инструкции" />
    </div>
    <div class="copy">
      <h1 class="copy__title">{{ props.title }}</h1>
      <p class="copy__description">{{ props.description }}</p>
    </div>
  </section>
</template>

<style scoped>
.instruction-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000;
  color: #fff;
  padding-top: 18px;
  padding-bottom: 110px;
}

.media {
  position: relative;
  width: 780px;
  max-width: calc(100% - 40px);
  margin-bottom: 140px;
}

.media__image {
  margin: 0;
  padding: 0;
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

.media__qr {
  position: absolute;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translateX(-50%);
  bottom: -100px;
  border-radius: 10px;
}

.copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: center;
}

.copy__title {
  color: #ffffff;
  width: 100%;
  font-size: 42px;
  line-height: 50px;
  font-weight: 400;
  text-align: center;
  margin: 0;
}

.copy__description {
  color: rgba(255, 255, 255, 0.78);
  width: 620px;
  max-width: calc(100% - 64px);
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  text-align: center;
  margin: 0;
}
</style>

<script setup lang="ts">
import AppKaraoke from "../components/AppKaraoke.vue";
import Img from '../assets/image/karaoke.png'
import qr from '../assets/image/qr_karaoke.png'

const text = 'Вы можете вызвать персонального ассистента для помощи с запуском.'

</script>

<template>
  <div class="container">
    <AppKaraoke
        :image="Img"
        :qr="qr"
        :description="text"
    />
  </div>
</template>

<style scoped>
.container {
  display: flex;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: black;
  font-family: "SF Pro Rounded", sans-serif;
}
</style>
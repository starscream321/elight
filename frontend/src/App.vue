<script setup lang="ts">
import Footer from './components/Footer.vue';
</script>

<template>
  <div class="app-wrapper">
    <main class="main-content">
      <router-view />
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.app-wrapper {
  width: 820px;
  height: 1180px;
  display: flex;
  flex-direction: column;
  font-family: "SF Pro Rounded", sans-serif;
}

.main-content {
  flex: 1;
  margin: 0 auto;
  width: 100%;
}
</style>
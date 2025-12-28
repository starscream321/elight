<script setup lang="ts">

import MainBtn from "./MainBtn.vue";
import {controlScenarios, fetchScenarios} from "../api/lightControll.ts";
import type {ScenariosFromApi, ScenariosFrontend} from "../types/scenarios.ts";
import {shallowRef, onMounted} from "vue";
import {iconMapScenarios} from "../icon/icons.ts";

const scenarios = shallowRef<ScenariosFrontend[]>([])

const updateScenarios = async () => {
  const data = await fetchScenarios()
  scenarios.value = [...data.map((value: ScenariosFromApi) => ({
    ...value,
    icon: iconMapScenarios[value.icon],
  }))]
}

const handleClick = async (id: string) => {
  await controlScenarios(id)
}

onMounted(async () => {
  await updateScenarios()
})


</script>

<template>
  <div class="buttons-scenarios">
    <MainBtn
        v-for="btn in scenarios"
        :key="btn.id"
        :name="btn.name"
        :icon="btn.icon"
        @click="handleClick(btn.id)"
        :active="false"
    />
  </div>
</template>

<style scoped>
.buttons-scenarios {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
  width: 100%;
  height: 616px;
}
</style>
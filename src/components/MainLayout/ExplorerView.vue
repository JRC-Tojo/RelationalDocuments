<template>
  <!-- TODO: 現状はコンテナ型が存在しないため、仮実装 -->
  <!-- 現行実装のfileはコンテナ導入後は削除 -->
  <!-- <ExpContainer v-for="container in containers" :container="container" :key="container.path" /> -->

  <template v-for="file in files" :key="file.path">
    <ExpFile v-if="file.type === 'File'" :file="file" />
    <ExpFolder v-if="file.type === 'Folder'" :folder="file" />
  </template>

  <q-btn
    v-show="files.length === 0"
    outline
    :label="$t('explorer.demo')"
    color="primary"
    class="full-width q-my-sm"
    @click="onCreateDemo"
  />
</template>

<script setup lang="ts">
import { useBackendApi } from 'src/apis/backendApi';
import { ref } from 'vue';
import { onMounted } from 'vue';
import ExpFile from './Explorer/ExpFile.vue';
import { createDemoData } from 'src/utils/appInitializer.js';
import type { ContainerElement } from 'src/models/container.js';
import ExpFolder from './Explorer/ExpFolder.vue';

const api = useBackendApi();

const files = ref<ContainerElement[]>([]);
// const containers = ref();

async function loadDocs() {
  const apiRes = await api.getAllDocuments();
  if (apiRes.ok) {
    files.value = apiRes.data;
  }
}

async function onCreateDemo() {
  await createDemoData();
  await loadDocs();
}

onMounted(async () => {
  // const apiRes = await api.getAllContainers();
  // if (apiRes.success) {
  //   containers.value = apiRes.data;
  // }
  await loadDocs();
});
</script>

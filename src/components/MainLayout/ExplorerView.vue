<template>
  <!-- TODO: 現状はコンテナ型が存在しないため、仮実装 -->
  <!-- 現行実装のfileはコンテナ導入後は削除 -->
  <!-- <ExpContainer v-for="container in containers" :container="container" :key="container.path" /> -->

  <ExpFile v-for="file in files" :key="file.id" :doc-id="file.id" :title="file.title" />
</template>

<script setup lang="ts">
import { useBackendApi } from 'src/apis/backendApi';
import type { DocumentMetadata } from 'src/models/schemas';
import { ref } from 'vue';
import { onMounted } from 'vue';
import ExpFile from './Explorer/ExpFile.vue';

const api = useBackendApi();

const files = ref<DocumentMetadata[]>([]);
// const containers = ref();

onMounted(async () => {
  // const apiRes = await api.getAllContainers();
  // if (apiRes.success) {
  //   containers.value = apiRes.data;
  // }
  const apiRes = await api.getAllDocuments();
  if (apiRes.success) {
    files.value = apiRes.data;
  }
});
</script>

<template>
  <q-page>
    <q-bar>
      <template v-for="tool in docpageStore.mainTools" :key="tool.icon">

      </template>
    </q-bar>


    
    <!-- <q-bar>
      <div>Sample Status</div>

      <q-space />

      <div>Zoom Level</div>
    </q-bar> -->
  </q-page>
</template>

<script setup lang="ts">
// import { useBackendApi } from 'src/apis/backendApi';
import { useDocPageStore } from 'src/stores/documentPageStore';
import { onBeforeMount } from 'vue';

// const api = useBackendApi()
const docpageStore = useDocPageStore()

onBeforeMount(async () => {
  // docpageStore.mainTools = api.get
})
</script>
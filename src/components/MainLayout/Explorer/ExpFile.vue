<template>
  <a href="#" class="full-width btn" @click="onClicked">
    <div class="items-center" style="display: flex">
      <q-icon name="insert_drive_file" color="red" />
      <p class="q-ma-none file-name">{{ title }}</p>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { DocumentId } from 'src/models/schemas';
import { useEditorStore } from 'src/stores/editorStore';

interface Prop {
  docId: DocumentId;
  title: string;
}
const prop = defineProps<Prop>();

const editStore = useEditorStore();

function onClicked() {
  editStore.openTab(prop.docId, prop.title);
}
</script>

<style lang="scss" scoped>
.btn {
  min-width: max-content;
  text-decoration: none;
  transition: 0.4s;
  :hover {
    background: lightgray;
  }

  .file-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>

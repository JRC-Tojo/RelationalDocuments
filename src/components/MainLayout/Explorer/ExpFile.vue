<template>
  <a href="#" class="full-width btn" @click="onClicked">
    <div class="items-center" style="display: flex">
      <q-icon name="insert_drive_file" color="red" />
      <p class="q-ma-none file-name">{{ filePath.basename() }}</p>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { ContainerElementFile } from 'src/models/container';
import { useEditorStore } from 'src/stores/editorStore';
import { Path } from 'src/utils/binary/path';

interface Prop {
  file: ContainerElementFile;
}
const prop = defineProps<Prop>();

const editStore = useEditorStore();
const filePath = new Path(prop.file.path);

function onClicked() {
  editStore.openTab(prop.file);
}
</script>

<style lang="scss" scoped>
@use 'sass:color';

.btn {
  min-width: max-content;
  text-decoration: none;
  transition: 0.4s;
  &:hover {
    background: color.adjust(gray, $alpha: -0.5);
  }

  .file-name {
    background: transparent;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

a:visited {
  color: inherit;
}
</style>

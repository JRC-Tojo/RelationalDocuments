<template>
  <p>This is Folder ({{ folderPath.basename() }})</p>
  <!-- <a href="#" class="full-width btn" @click="onClicked">
    <div class="items-center" style="display: flex">
      <q-icon name="insert_drive_file" color="red" />
      <p class="q-ma-none file-name">{{ folderPath.basename() }}</p>
    </div>
  </a> -->
</template>

<script setup lang="ts">
import type { ContainerElementFolder } from 'src/models/container';
import { Path } from 'src/utils/binary/path';

interface Prop {
  folder: ContainerElementFolder;
}
const prop = defineProps<Prop>();

const folderPath = new Path(prop.folder.path);
</script>

<style lang="scss" scoped></style>

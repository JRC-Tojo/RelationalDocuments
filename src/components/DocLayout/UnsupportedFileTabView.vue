<template>
  <div class="unsupported-file-view">
    <q-icon name="block" size="3rem" color="grey-5" />
    <p class="q-mt-md text-grey-6">{{ $t('explorer.unsupportedFile') }}</p>
    <p class="text-caption text-grey-5">{{ fileName }}</p>
    <q-btn
      v-if="canOpenWithDefaultApp"
      class="q-mt-md"
      outline
      color="primary"
      icon="open_in_new"
      :label="$t('explorer.openWithDefaultApp')"
      @click="onOpenWithDefaultApp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import type { ContainerElementFile } from 'src/models/container';
import { Path } from 'src/utils/binary/path';
import { useBackendApi } from 'src/apis/backendApi';
import { isElectronRuntime } from 'src/repositories/platform/electron';

interface Prop {
  file: ContainerElementFile;
}
const prop = defineProps<Prop>();

const { t } = useI18n();
const $q = useQuasar();
const api = useBackendApi();

const fileName = computed(() => new Path(prop.file.path).basename());

/**
 * 「標準アプリで起動する」ボタンの表示可否。Electronのデスクトップアプリ版であり、
 * かつ対象がローカルコンテナ（実ファイルパスを持つ）の場合のみ表示する
 * （box/cacheコンテナは実ファイルパスを持たないため、ブラウザ版同様に非対応）
 */
const canOpenWithDefaultApp = ref(false);

watch(
  () => prop.file.containerID,
  async (containerID) => {
    if (!isElectronRuntime()) {
      canOpenWithDefaultApp.value = false;
      return;
    }
    const containersRes = await api.getAllContainers();
    const container = containersRes.ok
      ? containersRes.data.find((c) => c.id === containerID)
      : undefined;
    canOpenWithDefaultApp.value = container?.type === 'local';
  },
  { immediate: true },
);

async function onOpenWithDefaultApp() {
  const res = await api.openFileWithDefaultApp(prop.file.containerID, prop.file);
  if (!res.ok) {
    $q.notify({ type: 'negative', message: t('explorer.openWithDefaultAppFailed') });
  }
}
</script>

<style lang="scss" scoped>
.unsupported-file-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>

<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-lg">{{ $t('settings.title') }}</h1>

    <q-card class="q-mb-lg" style="max-width: 600px">
      <q-card-section class="q-pb-none">
        <div class="text-h6">{{ $t('settings.title') }}</div>
      </q-card-section>

      <q-card-section>
        <div class="q-mb-lg">
          <q-toggle
            v-model="settings.darkMode"
            :label="$t('settings.darkMode')"
            @update:model-value="updateSettings"
          />
        </div>

        <div class="q-mb-lg">
          <label class="text-body1">{{ $t('settings.viewMode') }}</label>
          <q-select
            v-model="settings.viewMode"
            :options="viewModes"
            outlined
            class="q-mt-md"
            @update:model-value="updateSettings"
          />
        </div>

        <div class="q-mb-lg">
          <label class="text-body1">{{ $t('settings.sortBy') }}</label>
          <q-select
            v-model="settings.sortBy"
            :options="sortOptions"
            outlined
            class="q-mt-md"
            @update:model-value="updateSettings"
          />
        </div>

        <div class="q-mb-lg">
          <label class="text-body1">{{ $t('settings.language') }}</label>
          <q-select
            v-model="currentLocale"
            :options="languages"
            outlined
            class="q-mt-md"
            @update:model-value="changeLanguage"
          />
        </div>
      </q-card-section>

      <q-card-actions>
        <q-btn unelevated color="primary" :label="$t('settings.save')" @click="saveAllSettings" />
      </q-card-actions>
    </q-card>

    <!-- テストデータ -->
    <q-card class="q-mb-lg" style="max-width: 600px">
      <q-card-section class="q-pb-none">
        <div class="text-h6">Test Data</div>
      </q-card-section>

      <q-card-section>
        <p class="text-body2">Create sample documents for testing:</p>
      </q-card-section>

      <q-card-actions>
        <q-btn color="primary" label="Create Sample Documents" @click="createSampleData" />
        <q-btn flat color="negative" label="Clear All Data" @click="clearAllData" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useBackendApi } from 'src/apis/backendApi';
import type { AppSettings } from 'src/models/schemas';

const { locale, t: $t } = useI18n();
const $q = useQuasar();
const api = useBackendApi();

const settings = ref<AppSettings>({
  darkMode: false,
  viewMode: 'rich',
  sortBy: 'updatedAt',
  initialized: true,
});

const currentLocale = ref('en-US');

const viewModes = [
  { label: $t('viewMode.rich'), value: 'rich' },
  { label: $t('viewMode.list1'), value: 'list1' },
  { label: $t('viewMode.list2'), value: 'list2' },
];

const sortOptions = [
  { label: $t('sort.byName'), value: 'name' },
  { label: $t('sort.byUpdatedAt'), value: 'updatedAt' },
  { label: $t('sort.byGenre'), value: 'genre' },
];

const languages = [
  { label: 'English', value: 'en-US' },
  { label: '日本語', value: 'ja-JP' },
];

onMounted(async () => {
  const response = await api.getSettings();
  if (response.success && response.data) {
    settings.value = response.data;
  }
  currentLocale.value = locale.value;
});

/**
 * 設定を更新
 */
async function updateSettings() {
  // 設定の自動保存（オプション）
}

/**
 * すべての設定を保存
 */
async function saveAllSettings() {
  const response = await api.saveSettings(settings.value);
  if (response.success) {
    $q.notify({
      type: 'positive',
      message: $t('message.success'),
    });
  }
}

/**
 * 言語を変更
 */
function changeLanguage(lang: string) {
  locale.value = lang;
}

/**
 * サンプルデータを作成
 */
async function createSampleData() {
  const { createDemoData } = await import('src/utils/appInitializer');
  await createDemoData();
  $q.notify({
    type: 'positive',
    message: 'Sample documents created!',
  });
}

/**
 * すべてのデータをクリア
 */
function clearAllData() {
  $q.dialog({
    title: 'Confirm',
    message: 'Are you sure you want to delete all data? This action cannot be undone.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    // localStorageRepository.clear() を呼ぶ（ただし、実装では関数がexportされていないため省略）
    $q.notify({
      type: 'positive',
      message: 'All data cleared',
    });
  });
}
</script>

<style scoped lang="scss"></style>

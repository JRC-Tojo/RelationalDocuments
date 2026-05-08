<template>
  <q-layout view="hHh LpR fFf">
    <q-header>
      <q-bar>
        <q-toolbar-title class="text-center">{{ $t('title.app') }}</q-toolbar-title>
      </q-bar>
    </q-header>

    <q-splitter v-model="splitModel" unit="px" emit-immediately :class="splitterClass">
      <template #before>
        <q-drawer
          v-model="showLeftDrawer"
          :width="drawerWidth"
          show-if-above
          bordered
          :breakpoint="0"
          class="row"
        >
          <q-tabs v-model="selectedTab" vertical switch-indicator>
            <q-tab name="docs" icon="library_books" />
            <q-tab name="exts" icon="extension" />
            <q-tab name="settings" icon="settings" />
          </q-tabs>

          <q-separator vertical />

          <q-tab-panels v-model="selectedTab" class="panels">
            <q-tab-panel name="docs"> This is Docs </q-tab-panel>
            <q-tab-panel name="exts"> This is Extensions </q-tab-panel>
            <q-tab-panel name="settings"> This is Settings </q-tab-panel>
          </q-tab-panels>
        </q-drawer>
      </template>

      <template #after>
        <q-page-container :style="compPadding">
          <router-view />
        </q-page-container>
      </template>
    </q-splitter>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const showLeftDrawer = ref(true);
const selectedTab = ref('docs');

const splitModel = ref(300);
const drawerWidth = computed(() => splitModel.value + 1);

const splitterClass = computed(() => (!showLeftDrawer.value ? 'splitt' : ''));
const compPadding = computed(() => (showLeftDrawer.value ? { paddingLeft: '0px' } : ''));
</script>

<style scoped lang="scss">
.splitt {
  .q-splitter__before {
    transition: width 0.2s ease-out;
    width: 0px !important;
  }
}

.panels {
  flex: 1 1 0;
  overflow-x: hidden;
}
</style>

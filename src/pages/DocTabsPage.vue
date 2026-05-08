<template>
  <VueDraggable v-model="tabs" class="row">
    <!-- tabを並べる -->
    <div v-for="tab in tabs" :key="tab.documentId" class="bg-red">
      <!-- TODO: タブの詳細実装 -->
      {{ tab.title }}
    </div>

    <!-- タブコンテキストメニュー -->
    <!-- <q-menu
      v-model="showContextMenu"
      context-menu
      no-parent-event
      transition-show="scale"
      transition-hide="scale"
    >
      <q-list style="min-width: 200px">
        <q-item clickable @click="closeTab(contextMenuTabId)">
          <q-item-section>{{ $t('close') }}</q-item-section>
        </q-item>
        <q-item clickable @click="closeOtherTabs(contextMenuTabId)">
          <q-item-section>{{ $t('closeOthers') }}</q-item-section>
        </q-item>
        <q-item clickable @click="closeTabsToRight(contextMenuTabId)">
          <q-item-section>{{ $t('closeRight') }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable @click="closeAllTabs">
          <q-item-section>{{ $t('closeAll') }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable @click="toggleTabPin(contextMenuTabId)">
          <q-item-section>
            <q-icon
              :name="contextMenuTabPinned ? 'push_pin_outline' : 'push_pin'"
              class="q-mr-xs"
            />
            {{ contextMenuTabPinned ? $t('unpin') : $t('pin') }}
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu> -->
  </VueDraggable>

  <DocumentTabView v-if="selectedDocId" v-model="selectedDocId" />
  <div v-else>Not selected document.</div>
</template>

<script setup lang="ts">
import DocumentTabView from 'src/components/DocLayout/DocumentTabView.vue';
import type { DocumentTab } from 'src/models/docPage';
import { computed } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

const tabs = defineModel<DocumentTab[]>({ required: true });
const selectedDocId = computed(() => tabs.value[0]?.documentId ?? undefined);
</script>

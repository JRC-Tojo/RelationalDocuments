<template>
  <div class="doc-tabs-page">
    <!-- タブバー -->
    <div class="tabs-bar">
      <VueDraggable
        v-model="tabs"
        :animation="0"
        group="documentTabs"
        class="tabs-container"
        @add="onTabAdded"
        @remove="onTabRemoved"
      >
        <!-- タブを並べる -->
        <div
          v-for="tab in tabs"
          :key="tab.documentId"
          :class="['tab-item', { active: tab.documentId === selectedDocId && activeLayout === layoutSide }]"
          @click="selectTab(tab.documentId, true)"
        >
          <div class="tab-content">
            <q-icon name="description" class="tab-icon" />
            <span class="tab-title">{{ tab.title }}</span>
          </div>
          <q-btn
            flat
            dense
            round
            icon="close"
            size="xs"
            class="tab-close-btn"
            @click.stop="closeTab(tab.documentId)"
          />
        </div>
      </VueDraggable>
    </div>

    <!-- コンテンツエリア -->
    <div class="tabs-content">
      <DocumentTabView v-if="selectedDocId" :document-id="selectedDocId" :key="selectedDocId" />
      <div v-else class="empty-state">
        <q-icon name="description" size="3rem" color="grey-5" />
        <p class="q-mt-md text-grey-6">{{ $t('pdfEditor.document.noDocumentSelected') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DocumentTabView from 'src/components/DocLayout/DocumentTabView.vue';
import type { DocumentId } from 'src/models/schemas';
import { useEditorStore } from 'src/stores/editorStore';
import type { LayoutSide } from 'src/stores/editorStore';
import { computed } from 'vue';
import type { DraggableEvent } from 'vue-draggable-plus';
import { VueDraggable } from 'vue-draggable-plus';
import type { DocumentTab } from 'src/models/docPage';

interface Prop {
  layoutSide: LayoutSide;
}
const prop = defineProps<Prop>();

const editorStore = useEditorStore();
const tabs = computed({
  get: () => editorStore.tabs[prop.layoutSide],
  set: (newTabList) => {
    editorStore.tabs[prop.layoutSide] = newTabList;
  },
});
const selectedDocId = computed(() => editorStore.getActiveTab(prop.layoutSide)?.documentId);
const activeLayout = computed(() => editorStore.activeSide)

function selectTab(docId: DocumentId, isFocus: boolean) {
  editorStore.selectTab(docId, prop.layoutSide, isFocus);
}

function closeTab(docId: DocumentId) {
  editorStore.closeTab(docId, prop.layoutSide);
}

function onTabAdded(e: DraggableEvent<DocumentTab>) {
  const docId = tabs.value[e.newIndex ?? 0]?.documentId;
  if (docId !== void 0) selectTab(docId, true);
}

function onTabRemoved(e: DraggableEvent<DocumentTab>) {
  const targetIdx = (e.oldIndex ?? 0) - 1;
  const docId = tabs.value[targetIdx]?.documentId;
  if (docId !== void 0) selectTab(docId, false);
}
</script>

<style scoped lang="scss">
.doc-tabs-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $grey-1;
  overflow: hidden;
}

.tabs-bar {
  display: flex;
  align-items: center;
  background: white;
  border-bottom: 2px solid $primary;
  overflow-x: auto;
  overflow-y: hidden;
  height: 48px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: $grey-2;
  }

  &::-webkit-scrollbar-thumb {
    background: $grey-4;
    border-radius: 2px;

    &:hover {
      background: $grey-5;
    }
  }
}

.body--dark .tabs-bar {
  background: $dark;
  border-bottom-color: $primary;

  &::-webkit-scrollbar-track {
    background: $grey-8;
  }

  &::-webkit-scrollbar-thumb {
    background: $grey-7;

    &:hover {
      background: $grey-6;
    }
  }
}

.tabs-container {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  width: 100%;
  height: 100%;
}

.tab-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  min-width: 120px;
  max-width: 200px;
  background: $grey-2;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  border-top: 3px solid transparent;

  .tab-content {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;

    .tab-icon {
      font-size: 1.1rem;
      color: $grey-7;
      flex-shrink: 0;
    }

    .tab-title {
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: $grey-8;
      font-weight: 500;
    }
  }

  .tab-close-btn {
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      background-color: rgba($negative, 0.1);
      color: $negative;
    }
  }

  &:hover {
    background: $grey-3;

    .tab-close-btn {
      opacity: 1;
    }
  }

  &.active {
    background: white;
    border-top-color: $primary;
    color: $primary;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);

    .tab-content {
      .tab-icon {
        color: $primary;
      }

      .tab-title {
        color: $primary;
        font-weight: 600;
      }
    }

    .tab-close-btn {
      opacity: 1;
      color: $primary;
    }
  }
}

.body--dark .tab-item {
  background: $grey-8;

  .tab-content {
    .tab-icon {
      color: $grey-5;
    }

    .tab-title {
      color: $grey-4;
    }
  }

  &:hover {
    background: $grey-7;
  }

  &.active {
    background: darken($dark, 5%);
    border-top-color: $primary;

    .tab-content {
      .tab-icon {
        color: $primary;
      }

      .tab-title {
        color: $primary;
      }
    }

    .tab-close-btn {
      color: $primary;
    }
  }
}

.tabs-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: white;

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $grey-5;
  }
}

.body--dark .tabs-content {
  background: $dark;

  .empty-state {
    color: $grey-7;
  }
}
</style>

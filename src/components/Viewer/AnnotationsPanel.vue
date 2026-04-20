<template>
  <div class="annotations-panel">
    <!-- タブ -->
    <q-tabs
      v-model="activeTab"
      vertical
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="list" icon="edit" :label="$t('pdfEditor.annotations')" />
      <q-tab name="info" icon="info" :label="$t('document.title')" />
    </q-tabs>

    <!-- タブパネル -->
    <q-tab-panels v-model="activeTab" animated class="panel-content">
      <!-- アノテーション一覧 -->
      <q-tab-panel name="list" class="q-pa-md">
        <div v-if="currentPageAnnotations.length > 0" class="annotations-list">
          <div
            v-for="annotation in currentPageAnnotations"
            :key="annotation.id"
            class="annotation-item"
            :class="{ selected: selectedAnnotationId === annotation.id }"
            @click="$emit('select', annotation.id)"
          >
            <div class="row items-center justify-between q-mb-sm">
              <div class="row items-center gap-sm">
                <div class="color-indicator" :style="{ backgroundColor: annotation.color }" />
                <span class="text-weight-bold text-capitalize">{{ annotation.type }}</span>
              </div>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="close"
                color="negative"
                @click.stop="$emit('delete', annotation.id)"
              />
            </div>
            <div v-if="annotation.content" class="text-body2 text-grey-8">
              {{ annotation.content }}
            </div>
          </div>
        </div>
        <div v-else class="text-center text-grey q-my-lg">
          {{ $t('pdfEditor.noAnnotations') }}
        </div>
      </q-tab-panel>

      <!-- ドキュメント情報 -->
      <q-tab-panel name="info" class="q-pa-md">
        <div class="info-group q-mb-md">
          <div class="info-label">{{ $t('document.title') }}</div>
          <div class="info-value">{{ documentTitle }}</div>
        </div>

        <div class="info-group q-mb-md">
          <div class="info-label">{{ $t('document.pages') }}</div>
          <div class="info-value">{{ pageCount }}</div>
        </div>

        <div class="info-group q-mb-md">
          <div class="info-label">{{ $t('document.uploadedAt') }}</div>
          <div class="info-value">{{ uploadedDate }}</div>
        </div>

        <div v-if="genre" class="info-group q-mb-md">
          <div class="info-label">{{ $t('document.genre') }}</div>
          <div class="info-value">{{ genre }}</div>
        </div>

        <div v-if="tags && tags.length > 0" class="info-group">
          <div class="info-label">{{ $t('document.tags') }}</div>
          <div class="row gap-xs q-mt-sm">
            <q-chip
              v-for="tag in tags"
              :key="tag"
              size="sm"
              removable
              @remove="$emit('remove-tag', tag)"
            >
              {{ tag }}
            </q-chip>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Annotation {
  id: string;
  type: 'highlight' | 'line' | 'box' | 'circle' | 'image';
  pageNumber: number;
  color: string;
  content?: string;
}

interface Props {
  annotations: Annotation[];
  currentPage: number;
  selectedAnnotationId?: string | null;
  documentTitle: string;
  pageCount: number;
  uploadedDate: string;
  genre?: string;
  tags?: string[];
}

interface Emits {
  (e: 'select', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'remove-tag', tag: string): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const { t: $t } = useI18n();
const activeTab = ref('list');

const currentPageAnnotations = computed(() => {
  return props.annotations.filter((a) => a.pageNumber === props.currentPage);
});
</script>

<style scoped lang="scss">
.annotations-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-item {
  padding: 8px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &.selected {
    border-color: #1976d2;
    background: #e3f2fd;
  }

  &:hover {
    background: #f5f5f5;
  }
}

.color-indicator {
  width: 16px;
  height: 16px;
  border: 1px solid #ddd;
  border-radius: 2px;
}

.info-group {
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-weight: 600;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #333;
}

.gap-xs {
  gap: 4px;
}
</style>

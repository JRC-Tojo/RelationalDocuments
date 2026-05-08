<template>
  <q-bar class="document-footer">
    <!-- 左側：ページネーション -->
    <div class="footer-section footer-pagination">
      <q-btn flat dense icon="first_page" @click="onGoToFirstPage()" :disable="currentPage === 1" />
      <q-btn
        flat
        dense
        icon="navigate_before"
        @click="onPreviousPage()"
        :disable="currentPage === 1"
      />
      <input
        v-model.number="currentPage"
        type="number"
        class="page-input"
        :min="1"
        :max="totalPageCount"
      />
      <span class="page-info">/ {{ totalPageCount }}</span>
      <q-btn
        flat
        dense
        icon="navigate_next"
        @click="onNextPage()"
        :disable="currentPage === totalPageCount"
      />
      <q-btn
        flat
        dense
        icon="last_page"
        @click="onGoToLastPage()"
        :disable="currentPage === totalPageCount"
      />
    </div>

    <!-- セパレータ -->
    <q-separator vertical />

    <!-- 中央：タイル表示モード -->
    <div class="footer-section footer-tile-mode">
      <span class="section-label">{{ $t('tileMode') }}:</span>
      <q-btn-toggle
        v-model="docpageStore.tileMode"
        flat
        dense
        unelevated
        :options="tileModeOptions"
      />
    </div>

    <!-- セパレータ -->
    <q-separator vertical />

    <!-- 中央：表示モード -->
    <div class="footer-section footer-view-mode">
      <span class="section-label">{{ $t('viewMode') }}:</span>
      <q-btn-toggle v-model="viewMode" flat dense unelevated :options="viewModeOptions" />
    </div>

    <!-- セパレータ -->
    <q-separator vertical />

    <!-- 右側：ズームコントロール -->
    <div class="footer-section footer-zoom">
      <q-btn flat dense icon="zoom_out" @click="onZoomOut()" :disable="scale <= 20" />
      <input v-model.number="zoomLevel" type="number" class="zoom-input" :min="20" :max="800" />
      <span class="zoom-label">%</span>
      <q-btn flat dense icon="zoom_in" @click="onZoomIn()" :disable="scale >= 800" />
      <q-slider v-model="zoomLevel" :min="20" :max="800" :step="5" class="zoom-slider" />
    </div>
  </q-bar>
</template>

<script setup lang="ts">
import { useEditorStore } from 'src/stores/editorStore';
import type { ViewMode } from 'src/models/docPage';

interface Prop {
  totalPageCount: number;
  scale: number;
  onGoToFirstPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
  onNextPage: () => void;
  onGoToLastPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
defineProps<Prop>();

const currentPage = defineModel<number>('currentPage', { required: true });
const viewMode = defineModel<ViewMode>('viewMode', { required: true });
const zoomLevel = defineModel<number>('zoomLevel', { required: true });

const docpageStore = useEditorStore();

// タイル表示モード
const tileModeOptions = [
  { label: 'None', value: 'none' },
  { label: 'V', value: 'vertical' },
  { label: 'H', value: 'horizontal' },
  { label: 'Grid', value: 'grid' },
];

// 表示モード
const viewModeOptions = [
  { label: 'Single', value: 'single' },
  { label: 'Spread', value: 'spread' },
  { label: 'C Single', value: 'continuousSingle' },
  { label: 'C Spread', value: 'continuousSpread' },
];
</script>

<style scoped lang="scss">
.document-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: $grey-2;
  border-top: 1px solid $grey-4;
  padding: 0 0.5rem;
  height: 60px;

  .footer-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .section-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: $grey-8;
      white-space: nowrap;
    }
  }

  .footer-pagination {
    .page-input {
      width: 50px;
      padding: 0.25rem 0.5rem;
      border: 1px solid $grey-4;
      border-radius: 4px;
      text-align: center;
      font-size: 0.85rem;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.1);
      }
    }

    .page-info {
      font-size: 0.85rem;
      color: $grey-7;
      white-space: nowrap;
    }
  }

  .footer-tile-mode {
    :deep(.q-btn-toggle__container) {
      gap: 0.25rem;
    }
  }

  .footer-view-mode {
    :deep(.q-btn-toggle__container) {
      gap: 0.25rem;
    }
  }

  .footer-zoom {
    .zoom-input {
      width: 50px;
      padding: 0.25rem 0.5rem;
      border: 1px solid $grey-4;
      border-radius: 4px;
      text-align: center;
      font-size: 0.85rem;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.1);
      }
    }

    .zoom-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: $grey-8;
      white-space: nowrap;
    }

    .zoom-slider {
      width: 150px;
      margin: 0 0.5rem;
    }
  }
}
</style>

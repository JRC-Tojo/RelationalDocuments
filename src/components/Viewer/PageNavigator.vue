<template>
  <div class="page-navigator bg-white shadow-1">
    <div class="row items-center justify-between q-pa-md gap-md">
      <!-- 前のページボタン -->
      <q-btn flat icon="navigate_before" :disable="currentPage === 1" @click="$emit('previous')" />

      <!-- ページ入力 -->
      <div class="row items-center gap-md">
        <span class="text-body2">{{ $t('pdfEditor.page') }}</span>
        <q-input
          :model-value="currentPage"
          type="number"
          outlined
          dense
          style="width: 80px"
          @update:model-value="updatePageNumber"
          min="1"
          :max="totalPages"
        />
        <span class="text-body2">/ {{ totalPages }}</span>
      </div>

      <!-- 次のページボタン -->
      <q-btn
        flat
        icon="navigate_next"
        :disable="currentPage === totalPages"
        @click="$emit('next')"
      />

      <q-space />

      <!-- ビューモード -->
      <q-option-group
        :model-value="viewMode"
        :options="viewModeOptions"
        color="primary"
        inline
        dense
        @update:model-value="$emit('update:viewMode', $event)"
      />

      <q-separator vertical class="q-mx-md" />

      <!-- ズーム -->
      <div class="row items-center gap-sm">
        <q-btn flat dense icon="zoom_out" @click="$emit('zoom-out')" />
        <q-input
          :model-value="zoom"
          type="number"
          outlined
          dense
          style="width: 80px"
          @update:model-value="updateZoom"
          suffix="%"
          min="50"
          max="300"
        />
        <q-btn flat dense icon="zoom_in" @click="$emit('zoom-in')" />
        <q-btn flat dense icon="zoom_to_fit" @click="$emit('zoom-to-fit')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

interface Props {
  currentPage: number;
  totalPages: number;
  zoom: number;
  viewMode: 'single' | 'continuous' | 'spread';
}

interface Emits {
  (e: 'previous'): void;
  (e: 'next'): void;
  (e: 'update:page', value: number): void;
  (e: 'update:zoom', value: number): void;
  (e: 'update:viewMode', value: 'single' | 'continuous' | 'spread'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-to-fit'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t: $t } = useI18n();

const viewModeOptions = [
  { label: $t('pdfEditor.singlePage'), value: 'single' },
  { label: $t('pdfEditor.continuous'), value: 'continuous' },
  { label: $t('pdfEditor.twoPages'), value: 'spread' },
];

/**
 * ページ番号を更新
 */
function updatePageNumber(value: string | number | null) {
  if (value !== null && value !== undefined && value !== '') {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue)) {
      const validPage = Math.max(1, Math.min(props.totalPages, numValue));
      emit('update:page', validPage);
    }
  }
}

/**
 * ズームを更新
 */
function updateZoom(value: string | number | null) {
  if (value !== null && value !== undefined && value !== '') {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue)) {
      const validZoom = Math.max(50, Math.min(300, numValue));
      emit('update:zoom', validZoom);
    }
  }
}
</script>

<style scoped lang="scss">
.page-navigator {
  flex-shrink: 0;
  border-top: 1px solid #e0e0e0;
}

.gap-md {
  gap: 12px;
}

.gap-sm {
  gap: 8px;
}
</style>

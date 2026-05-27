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
  gap: 1rem;
  background-color: $grey-1;
  border-top: 1px solid $grey-3;
  padding: 0 1rem;
  height: 64px;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.08);
  overflow-x: auto;

  .footer-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .section-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: $grey-8;
      white-space: nowrap;
    }
  }

  .footer-pagination {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .page-input {
      width: 50px;
      padding: 0.5rem 0.75rem;
      border: 1px solid $grey-4;
      border-radius: 6px;
      text-align: center;
      font-size: 0.9rem;
      font-weight: 500;
      background: white;
      transition: all 0.2s ease;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.1);
        background: white;
      }

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &[type='number'] {
        appearance: textfield;
        -moz-appearance: textfield;
      }
    }

    .page-info {
      font-size: 0.9rem;
      color: $grey-7;
      white-space: nowrap;
      font-weight: 500;
    }
  }

  .footer-tile-mode {
    :deep(.q-btn-toggle__container) {
      gap: 0.25rem;
      background: $grey-2;
      border-radius: 6px;
      padding: 2px;

      .q-btn {
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;

        &.q-btn--active {
          background: white;
          color: $primary;
        }
      }
    }
  }

  .footer-view-mode {
    :deep(.q-btn-toggle__container) {
      gap: 0.25rem;
      background: $grey-2;
      border-radius: 6px;
      padding: 2px;

      .q-btn {
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;

        &.q-btn--active {
          background: white;
          color: $primary;
        }
      }
    }
  }

  .footer-zoom {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .zoom-input {
      width: 50px;
      padding: 0.5rem 0.75rem;
      border: 1px solid $grey-4;
      border-radius: 6px;
      text-align: center;
      font-size: 0.9rem;
      font-weight: 500;
      background: white;
      transition: all 0.2s ease;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.1);
        background: white;
      }

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &[type='number'] {
        appearance: textfield;
        -moz-appearance: textfield;
      }
    }

    .zoom-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: $grey-8;
      white-space: nowrap;
      min-width: 20px;
    }

    .zoom-slider {
      width: 120px;
      margin: 0 0.5rem;

      :deep(.q-slider) {
        color: $primary;
      }
    }
  }
}

.body--dark .document-footer {
  background-color: darken($dark, 5%);
  border-top-color: $grey-8;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.3);

  .footer-section {
    .section-label {
      color: $grey-3;
    }
  }

  .footer-pagination {
    .page-input {
      background: $grey-8;
      border-color: $grey-7;
      color: $grey-2;

      &:focus {
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.2);
        background: darken($grey-8, 5%);
      }
    }

    .page-info {
      color: $grey-4;
    }
  }

  .footer-tile-mode {
    :deep(.q-btn-toggle__container) {
      background: $grey-8;

      .q-btn {
        color: $grey-4;

        &.q-btn--active {
          background: darken($dark, 3%);
          color: $primary;
        }
      }
    }
  }

  .footer-view-mode {
    :deep(.q-btn-toggle__container) {
      background: $grey-8;

      .q-btn {
        color: $grey-4;

        &.q-btn--active {
          background: darken($dark, 3%);
          color: $primary;
        }
      }
    }
  }

  .footer-zoom {
    .zoom-input {
      background: $grey-8;
      border-color: $grey-7;
      color: $grey-2;

      &:focus {
        border-color: $primary;
        box-shadow: 0 0 0 2px rgba($primary, 0.2);
        background: darken($grey-8, 5%);
      }
    }

    .zoom-label {
      color: $grey-3;
    }
  }
}
</style>

<template>
  <q-drawer v-model="drawerOpen" side="right" bordered class="document-right-drawer">
    <!-- アノテーション選択時の詳細 -->
    <div v-if="selectedAnnotations.length === 1" class="drawer-section q-pa-md">
      <h6 class="q-my-none q-mb-md">{{ $t('annotationProperties') }}</h6>
      <div class="annotation-properties">
        <!-- アノテーション型 -->
        <div class="property-group q-mb-md">
          <label class="property-label">{{ $t('type') }}</label>
          <div class="property-value">{{ selectedAnnotationType }}</div>
        </div>

        <!-- 色選択 -->
        <div class="property-group q-mb-md">
          <label class="property-label">{{ $t('color') }}</label>
          <div class="color-picker">
            <input
              v-model="annotationColor"
              type="color"
              class="color-input"
              @change="updateAnnotationColor"
            />
            <span class="color-value">{{ annotationColor }}</span>
          </div>
        </div>

        <!-- 線の太さ -->
        <div class="property-group q-mb-md">
          <label class="property-label">{{ $t('strokeWidth') }}</label>
          <div class="slider-container">
            <q-slider
              v-model="annotationStrokeWidth"
              :min="1"
              :max="10"
              :step="0.5"
              label
              @update:model-value="updateAnnotationStrokeWidth"
            />
          </div>
        </div>

        <!-- 透明度 -->
        <div class="property-group q-mb-md">
          <label class="property-label">{{ $t('opacity') }}</label>
          <div class="slider-container">
            <q-slider
              v-model="annotationOpacity"
              :min="0"
              :max="1"
              :step="0.1"
              label
              @update:model-value="updateAnnotationOpacity"
            />
          </div>
        </div>

        <!-- 関係性設定 -->
        <q-separator class="q-my-md" />
        <div class="property-group q-mb-md">
          <label class="property-label">{{ $t('relations') }}</label>
          <q-btn outline color="primary" icon="link" :label="$t('addRelation')" size="sm" />
        </div>

        <!-- 削除ボタン -->
        <q-separator class="q-my-md" />
        <q-btn outline color="negative" icon="delete" :label="$t('delete')" class="full-width" />
      </div>
    </div>

    <!-- アノテーション未選択時 -->
    <div v-else class="drawer-empty q-pa-md">
      <q-icon name="info" size="2rem" color="grey-5" />
      <p class="q-mt-md text-grey-6">{{ $t('selectAnnotationForProperties') }}</p>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Annotation } from 'src/models/schemas';

const drawerOpen = defineModel<boolean>('drawerOpen', { required: true })
const selectedAnnotations = defineModel<Annotation[]>('selectedAnt', { required: true })

// アノテーションのプロパティ（デモ用）
const annotationColor = ref('#000000');
const annotationStrokeWidth = ref(2);
const annotationOpacity = ref(1);

const selectedAnnotationType = computed(() => {
  // TODO: 実装時には選択されたアノテーションから型を取得
  return 'Line';
});

/**
 * アノテーションの色を更新
 */
const updateAnnotationColor = () => {
  // TODO: バックエンドに反映
};

/**
 * アノテーションの線の太さを更新
 */
const updateAnnotationStrokeWidth = () => {
  // TODO: バックエンドに反映
};

/**
 * アノテーションの透明度を更新
 */
const updateAnnotationOpacity = () => {
  // TODO: バックエンドに反映
};
</script>

<style scoped lang="scss">
.document-right-drawer {
  .drawer-section {
    h6 {
      font-weight: 600;
      font-size: 0.95rem;
      color: $primary;
    }
  }

  .annotation-properties {
    .property-group {
      .property-label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        color: $grey-8;
        margin-bottom: 0.5rem;
      }

      .property-value {
        padding: 0.5rem;
        background-color: $grey-2;
        border-radius: 4px;
        font-size: 0.9rem;
        color: $grey-7;
      }
    }

    .color-picker {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .color-input {
        width: 50px;
        height: 40px;
        border: 1px solid $grey-4;
        border-radius: 4px;
        cursor: pointer;
      }

      .color-value {
        font-size: 0.9rem;
        font-family: monospace;
        color: $grey-7;
      }
    }

    .slider-container {
      padding: 0.5rem 0;
    }
  }

  .drawer-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    text-align: center;
  }
}
</style>

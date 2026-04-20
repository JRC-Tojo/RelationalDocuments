<template>
  <div class="annotation-toolbar">
    <!-- ハイライトツール -->
    <q-btn
      :icon="isHighlighting ? 'check' : 'format_color_highlight'"
      :color="isHighlighting ? 'primary' : 'grey-7'"
      flat
      dense
      :title="$t('pdfEditor.highlight')"
      @click="toggleHighlight"
    />

    <!-- 直線ツール -->
    <q-btn
      :icon="isDrawingLine ? 'check' : 'edit'"
      :color="isDrawingLine ? 'primary' : 'grey-7'"
      flat
      dense
      :title="$t('pdfEditor.line')"
      @click="toggleLine"
    />

    <!-- ボックスツール -->
    <q-btn
      :icon="isDrawingBox ? 'check' : 'crop_square'"
      :color="isDrawingBox ? 'primary' : 'grey-7'"
      flat
      dense
      :title="$t('pdfEditor.box')"
      @click="toggleBox"
    />

    <!-- 円ツール -->
    <q-btn
      :icon="isDrawingCircle ? 'check' : 'radio_button_unchecked'"
      :color="isDrawingCircle ? 'primary' : 'grey-7'"
      flat
      dense
      :title="$t('pdfEditor.circle')"
      @click="toggleCircle"
    />

    <!-- 画像ツール -->
    <q-btn
      :icon="isAddingImage ? 'check' : 'image'"
      :color="isAddingImage ? 'primary' : 'grey-7'"
      flat
      dense
      :title="$t('pdfEditor.image')"
      @click="toggleImage"
    />

    <q-separator vertical class="q-mx-sm" />

    <!-- 色選択 -->
    <div class="row items-center gap-xs">
      <q-btn
        v-for="color in colors"
        :key="color"
        flat
        round
        dense
        size="sm"
        :style="{
          backgroundColor: color,
          border: selectedColor === color ? '2px solid #000' : 'none',
        }"
        @click="selectedColor = color"
      />
    </div>

    <q-separator vertical class="q-mx-sm" />

    <!-- クリア -->
    <q-btn
      icon="clear"
      flat
      dense
      color="negative"
      :title="$t('button.delete')"
      @click="$emit('clear')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

interface Props {
  modelValue?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'update:color', value: string): void;
  (e: 'clear'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const currentTool = ref<string>('highlight');
const selectedColor = ref<string>('#FFD700');

const colors = [
  '#FFD700', // Gold
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

const isHighlighting = computed(() => currentTool.value === 'highlight');
const isDrawingLine = computed(() => currentTool.value === 'line');
const isDrawingBox = computed(() => currentTool.value === 'box');
const isDrawingCircle = computed(() => currentTool.value === 'circle');
const isAddingImage = computed(() => currentTool.value === 'image');

/**
 * ハイライトツールを切り替え
 */
function toggleHighlight() {
  currentTool.value = currentTool.value === 'highlight' ? '' : 'highlight';
  emit('update:modelValue', currentTool.value);
}

/**
 * 直線ツールを切り替え
 */
function toggleLine() {
  currentTool.value = currentTool.value === 'line' ? '' : 'line';
  emit('update:modelValue', currentTool.value);
}

/**
 * ボックスツールを切り替え
 */
function toggleBox() {
  currentTool.value = currentTool.value === 'box' ? '' : 'box';
  emit('update:modelValue', currentTool.value);
}

/**
 * 円ツールを切り替え
 */
function toggleCircle() {
  currentTool.value = currentTool.value === 'circle' ? '' : 'circle';
  emit('update:modelValue', currentTool.value);
}

/**
 * 画像ツールを切り替え
 */
function toggleImage() {
  currentTool.value = currentTool.value === 'image' ? '' : 'image';
  emit('update:modelValue', currentTool.value);
}
</script>

<style scoped lang="scss">
.annotation-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.gap-xs {
  gap: 4px;
}
</style>

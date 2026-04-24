<template>
  <v-rect
    :config="rectConfig"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
    @dragmove="onDragMove"
    @transformend="onTransformEnd"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type Konva from 'konva';
import type { Annotation } from 'src/models/schemas';
import dayjs from 'dayjs';

type KonvaEvent = Konva.KonvaEventObject<Event>;

interface Props {
  annotation: Annotation;
  isSelected: boolean;
  isEditing: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: string];
  update: [annotation: Annotation];
  delete: [id: string];
}>();

const isHovered = ref(false);

/**
 * ボックス矩形の設定を計算
 */
const rectConfig = computed(() => {
  if (props.annotation.type !== 'box') return;
  return {
    id: props.annotation.id, // ← IDを追加
    x: props.annotation.x,
    y: props.annotation.y,
    width: props.annotation.width ?? 0,
    height: props.annotation.height ?? 0,
    fill: 'transparent',
    stroke: props.annotation.color,
    strokeWidth: props.annotation.strokeWidth || 2,
    draggable: props.isEditing,
    opacity: props.annotation.opacity || 1,
  };
});

/**
 * マウスホバー時の処理
 */
function onMouseEnter() {
  isHovered.value = true;
}

function onMouseLeave() {
  isHovered.value = false;
}

/**
 * マウスダウン時の選択
 */
function onMouseDown() {
  emit('select', props.annotation.id);
}

/**
 * ドラッグ移動完了
 */
function onDragMove(e: KonvaEvent) {
  const target = e.target as Konva.Rect;
  const updatedAnnotation = {
    ...props.annotation,
    x: target.x(),
    y: target.y(),
    updatedAt: dayjs().toISOString(),
  };
  emit('update', updatedAnnotation);
}

/**
 * トランスフォーム（リサイズ）完了
 */
function onTransformEnd(e: KonvaEvent) {
  const node = e.target as Konva.Rect;
  const updatedAnnotation = {
    ...props.annotation,
    x: node.x(),
    y: node.y(),
    width: Math.max(5, node.width() * node.scaleX()),
    height: Math.max(5, node.height() * node.scaleY()),
    updatedAt: dayjs().toISOString(),
  };
  node.scaleX(1);
  node.scaleY(1);
  emit('update', updatedAnnotation);
}
</script>

<style scoped lang="scss">
// Konvaコンポーネントはスタイル不要
</style>

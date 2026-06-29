<template>
  <v-line
    :config="lineConfig"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @dragmove="onDragMove"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type Konva from 'konva';
import dayjs from 'dayjs';
import type { AnnotationStyle } from 'src/models/document/pdf';

type KonvaEvent = Konva.KonvaEventObject<Event>;

interface Props {
  annotation: AnnotationStyle;
  isEditing: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: string];
  update: [annotation: AnnotationStyle];
  delete: [id: string];
}>();

const isHovered = ref(false);

/**
 * 線の設定を計算
 */
const lineConfig = computed(() => {
  if (props.annotation.type !== 'line') return;
  const points = props.annotation.points || [
    0,
    0,
    props.annotation.x2 ?? 0,
    props.annotation.y2 ?? 0,
  ];
  return {
    id: props.annotation.id,
    x: props.annotation.x,
    y: props.annotation.y,
    points: points,
    stroke: props.annotation.color,
    strokeWidth: props.annotation.strokeWidth || 2,
    draggable: props.isEditing,
    opacity: props.annotation.opacity || 1,
    hitStrokeWidth: 8, // ヒット判定を広くする
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
 * ドラッグ移動完了
 */
function onDragMove(e: KonvaEvent) {
  const target = e.target as Konva.Line;
  const updatedAnnotation = {
    ...props.annotation,
    x: target.x(),
    y: target.y(),
    updatedAt: dayjs().toISOString(),
  };
  emit('update', updatedAnnotation);
}
</script>

<style scoped lang="scss">
// Konvaコンポーネントはスタイル不要
</style>

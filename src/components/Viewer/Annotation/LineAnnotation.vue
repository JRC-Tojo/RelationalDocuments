<template>
  <!-- Group used so line and its endpoint anchors move together when dragged -->
  <v-group
    ref="groupRef"
    :config="{
      x: props.annotation.x,
      y: props.annotation.y,
      id: props.annotation.id,
      draggable: props.isEditing,
    }"
    @dragend="onDragEnd"
  >
    <v-line
      ref="lineRef"
      :config="lineConfig"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @transformend="onTransformEnd"
    />

    <!-- Endpoint anchors: shown only when the annotation is selected for editing -->
    <template v-if="props.isEditing && props.isSelected">
      <v-circle
        ref="anchor1Ref"
        :config="anchor1Config"
        @dragmove="(e) => onAnchorDrag(0, e)"
        @dragend="(e) => onAnchorDragEnd(0, e)"
      />
      <v-circle
        ref="anchor2Ref"
        :config="anchor2Config"
        @dragmove="(e) => onAnchorDrag(1, e)"
        @dragend="(e) => onAnchorDragEnd(1, e)"
      />
    </template>
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type Konva from 'konva';
import dayjs from 'dayjs';
import type { AnnotationStyle, LineAnnotationStyle } from 'src/models/document/pdf';

type KonvaEvent = Konva.KonvaEventObject<Event>;

interface Props {
  annotation: LineAnnotationStyle;
  isEditing: boolean;
  isSelected?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  update: [annotation: LineAnnotationStyle];
  delete: [id: string];
}>();

const groupRef = ref<{ getNode: () => Konva.Group | null } | null>(null);
const lineRef = ref<{ getNode: () => Konva.Line | null } | null>(null);
const anchor1Ref = ref<{ getNode: () => Konva.Circle | null } | null>(null);
const anchor2Ref = ref<{ getNode: () => Konva.Circle | null } | null>(null);
const isHovered = ref(false);

const lineConfig = computed(() => {
  if (props.annotation.type !== 'line') return;
  const points = props.annotation.points || [
    0,
    0,
    props.annotation.x2 ?? 0,
    props.annotation.y2 ?? 0,
  ];
  // 線はグループ内部に描画されます。グループが x/y の変換を処理するため、points はグループ座標系相対です。
  return {
    id: props.annotation.id,
    name: 'annotation-shape',
    points: points,
    stroke: props.annotation.color,
    strokeWidth: props.annotation.strokeWidth || 2,
    draggable: false,
    opacity: props.annotation.opacity || 1,
    hitStrokeWidth: 8,
  };
});

const anchor1Config = computed(() => {
  const points = props.annotation.points || [
    0,
    0,
    props.annotation.x2 ?? 0,
    props.annotation.y2 ?? 0,
  ];
  return {
    x: points[0],
    y: points[1],
    radius: 6,
    name: 'annotation-anchor',
    fill: '#ffffff',
    stroke: props.annotation.color,
    strokeWidth: 2,
    draggable: props.isEditing && !!props.isSelected,
    listening: props.isEditing && !!props.isSelected,
    cursor: props.isEditing && !!props.isSelected ? 'grab' : 'default',
  };
});

const anchor2Config = computed(() => {
  const points = props.annotation.points || [
    0,
    0,
    props.annotation.x2 ?? 0,
    props.annotation.y2 ?? 0,
  ];
  return {
    x: points[2],
    y: points[3],
    radius: 6,
    name: 'annotation-anchor',
    fill: '#ffffff',
    stroke: props.annotation.color,
    strokeWidth: 2,
    draggable: props.isEditing && !!props.isSelected,
    listening: props.isEditing && !!props.isSelected,
    cursor: props.isEditing && !!props.isSelected ? 'grab' : 'default',
  };
});

function getNode() {
  // 親が Transformer を割り当てられるようにグループノードを公開します
  return groupRef.value?.getNode() ?? lineRef.value?.getNode() ?? null;
}

defineExpose({ getNode });

function onMouseEnter() {
  isHovered.value = true;
}

function onMouseLeave() {
  isHovered.value = false;
}

function onDragEnd(e: KonvaEvent) {
  // グループがドラッグされたときに注釈の x/y を更新します
  const target = (e.target as Konva.Group) ?? e.target;
  const updatedAnnotation = {
    ...props.annotation,
    x: target.x(),
    y: target.y(),
    updatedAt: dayjs().toISOString(),
  };
  emit('update', updatedAnnotation);
}

function onTransformEnd(e: KonvaEvent) {
  // Transformer による変更（回転やスケール）を反映するため、ポイントとグループ位置を取得します。
  // const node = e.target as Konva.Group | Konva.Line;
  // Transformer がグループにアタッチされている場合は、子のラインノードから points を取得します。
  const lineNode = lineRef.value?.getNode() as Konva.Line | null;
  const points = lineNode ? (lineNode.points() as [number, number, number, number]) : [];
  const groupNode = groupRef.value?.getNode();

  const updatedAnnotation: AnnotationStyle = {
    ...props.annotation,
    type: 'line',
    x: groupNode ? groupNode.x() : props.annotation.x,
    y: groupNode ? groupNode.y() : props.annotation.y,
    points: points.length ? [points[0], points[1], points[2], points[3]] : props.annotation.points,
    x2: (groupNode ? groupNode.x() : props.annotation.x) + (points[2] ?? props.annotation.x2 ?? 0),
    y2: (groupNode ? groupNode.y() : props.annotation.y) + (points[3] ?? props.annotation.y2 ?? 0),
    updatedAt: dayjs().toISOString(),
  };
  // スケールはリセットしておきます（transformer の影響を除去）
  if (lineNode) {
    lineNode.scaleX(1);
    lineNode.scaleY(1);
  }
  emit('update', updatedAnnotation);
}

// アンカのドラッグハンドラ: index 0 = 先頭、index 1 = 末端
function onAnchorDrag(idx: number, e: KonvaEvent) {
  // 表示をリアルタイム更新するため、ラインの points をその場で更新します
  const lineNode = lineRef.value?.getNode();
  if (!lineNode) return;
  const points = lineNode.points().slice();
  const anchor = e.target as Konva.Circle;
  if (idx === 0) {
    points[0] = anchor.x();
    points[1] = anchor.y();
  } else {
    points[2] = anchor.x();
    points[3] = anchor.y();
  }
  lineNode.points(points);
}

function onAnchorDragEnd(idx: number, e: KonvaEvent) {
  const groupNode = groupRef.value?.getNode();
  const lineNode = lineRef.value?.getNode();
  if (!lineNode || !groupNode) return;
  const points = lineNode.points() as [number, number, number, number];
  const updatedAnnotation: AnnotationStyle = {
    ...props.annotation,
    type: 'line',
    x: groupNode.x(),
    y: groupNode.y(),
    points: [points[0], points[1], points[2], points[3]],
    x2: groupNode.x() + points[2],
    y2: groupNode.y() + points[3],
    updatedAt: dayjs().toISOString(),
  };
  emit('update', updatedAnnotation);
}
</script>

<style scoped lang="scss">
// Konvaコンポーネントはスタイル不要
</style>

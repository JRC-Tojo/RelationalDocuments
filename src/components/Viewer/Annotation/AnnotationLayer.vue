<template>
  <div class="annotation-layer-wrapper">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @click="handleStageClick"
    >
      <v-layer>
        <!-- ハイライトアノテーション -->
        <HighlightAnnotation
          v-for="annotation in highlightAnnotations"
          :key="annotation.id"
          :annotation="annotation"
          :is-selected="selectedAnnotationId === annotation.id"
          :is-editing="isEditing"
          @select="selectAnnotation"
          @update="updateAnnotation"
          @delete="deleteAnnotation"
        />

        <!-- ボックスアノテーション -->
        <BoxAnnotation
          v-for="annotation in boxAnnotations"
          :key="annotation.id"
          :annotation="annotation"
          :is-selected="selectedAnnotationId === annotation.id"
          :is-editing="isEditing"
          @select="selectAnnotation"
          @update="updateAnnotation"
          @delete="deleteAnnotation"
        />

        <!-- 線アノテーション -->
        <LineAnnotation
          v-for="annotation in lineAnnotations"
          :key="annotation.id"
          :annotation="annotation"
          :is-selected="selectedAnnotationId === annotation.id"
          :is-editing="isEditing"
          @select="selectAnnotation"
          @update="updateAnnotation"
          @delete="deleteAnnotation"
        />

        <!-- 円アノテーション -->
        <CircleAnnotation
          v-for="annotation in circleAnnotations"
          :key="annotation.id"
          :annotation="annotation"
          :is-selected="selectedAnnotationId === annotation.id"
          :is-editing="isEditing"
          @select="selectAnnotation"
          @update="updateAnnotation"
          @delete="deleteAnnotation"
        />

        <!-- 描画中のプレビュー -->
        <v-rect
          v-if="
            isDrawing && drawingPreview && (drawingType === 'highlight' || drawingType === 'box')
          "
          :config="drawingPreview.rect"
        />
        <v-line
          v-if="isDrawing && drawingPreview && drawingType === 'line'"
          :config="drawingPreview.line"
        />
        <v-circle
          v-if="isDrawing && drawingPreview && drawingType === 'circle'"
          :config="drawingPreview.circle"
        />

        <!-- トランスフォーマー（選択時のリサイズ操作用） -->
        <v-transformer v-if="selectedAnnotationId && isEditing" :config="transformerConfig" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, reactive } from 'vue';
import HighlightAnnotation from './HighlightAnnotation.vue';
import BoxAnnotation from './BoxAnnotation.vue';
import LineAnnotation from './LineAnnotation.vue';
import CircleAnnotation from './CircleAnnotation.vue';
import type { Annotation, AnnotationType } from 'src/models/schemas';
import { annotationDrawingManager } from 'src/components/Viewer/Annotation/annotationDrawingManager';
import type Konva from 'konva';
import type { Node, NodeConfig } from 'konva/lib/Node';

// Konvaイベント型定義
type KonvaMouseEvent = Konva.KonvaEventObject<MouseEvent>;

interface Props {
  annotations: Annotation[];
  drawingType: AnnotationType;
  selectedColor: string;
  pageNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  isEditing: boolean;
  zoomLevel?: number; // ← ズームレベルを追加
}

const props = defineProps<Props>();

const emit = defineEmits<{
  addAnnotation: [annotation: Annotation];
  updateAnnotation: [annotation: Annotation];
  deleteAnnotation: [id: string];
  selectAnnotation: [id: string];
}>();

const stageRef = ref<Konva.Stage | null>(null);
const selectedAnnotationId = ref<string | null>(null);
const isDrawing = ref(false);
const startPos = ref<{ x: number; y: number } | null>(null);
const drawingPreview = ref<{
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    opacity: number;
    stroke?: string;
    strokeWidth?: number;
  };
  line?: { x: number; y: number; points: number[]; stroke: string; strokeWidth: number };
  circle?: { x: number; y: number; radius: number; stroke: string; strokeWidth: number };
} | null>(null);
// Transformerの設定。nodes プロパティで制御する
const transformerConfig = reactive({
  nodes: [] as Node<NodeConfig>[],
});

/**
 * ステージ設定
 */
const stageConfig = computed(() => ({
  width: props.canvasWidth,
  height: props.canvasHeight,
}));

/**
 * タイプ別アノテーション（計算プロパティ）
 */
const highlightAnnotations = computed(() =>
  props.annotations.filter((a) => a.type === 'highlight'),
);
const boxAnnotations = computed(() => props.annotations.filter((a) => a.type === 'box'));
const lineAnnotations = computed(() => props.annotations.filter((a) => a.type === 'line'));
const circleAnnotations = computed(() => props.annotations.filter((a) => a.type === 'circle'));

/**
 * マウスダウンイベント
 */
function handleMouseDown(e: KonvaMouseEvent) {
  // 編集モードが有効でない場合はスキップ
  if (!props.isEditing) {
    return;
  }

  // 既存の図形をクリックした場合はスキップ
  if (e.target !== e.target.getStage()) {
    return;
  }

  const stage = e.target.getStage();
  const pos = stage.getPointerPosition();
  if (!pos) return;

  // ズームレベルで座標を調整（スケール倍率を適用）
  const scale = props.zoomLevel ? props.zoomLevel / 100 : 1;
  const adjustedPos = {
    x: pos.x / scale,
    y: pos.y / scale,
  };

  isDrawing.value = true;
  startPos.value = adjustedPos;
  annotationDrawingManager.startDrawing(adjustedPos.x, adjustedPos.y);
  updateDrawingPreview(adjustedPos.x, adjustedPos.y);
}

/**
 * マウス移動イベント
 */
function handleMouseMove(e: KonvaMouseEvent) {
  if (!isDrawing.value || !startPos.value) return;

  const stage = e.target?.getStage();
  if (!stage) return;

  const pos = stage.getPointerPosition();
  if (!pos) return;

  // ズームレベルで座標を調整
  const scale = props.zoomLevel ? props.zoomLevel / 100 : 1;
  const adjustedPos = {
    x: pos.x / scale,
    y: pos.y / scale,
  };

  updateDrawingPreview(adjustedPos.x, adjustedPos.y);
}

/**
 * マウスアップイベント
 */
function handleMouseUp(e: KonvaMouseEvent) {
  if (!isDrawing.value || !startPos.value) return;

  const stage = e.target?.getStage();
  if (!stage) return;

  const pos = stage.getPointerPosition();
  if (!pos) return;

  // ズームレベルで座標を調整
  const scale = props.zoomLevel ? props.zoomLevel / 100 : 1;
  const adjustedPos = {
    x: pos.x / scale,
    y: pos.y / scale,
  };

  isDrawing.value = false;
  drawingPreview.value = null;

  const annotation = annotationDrawingManager.endDrawing(adjustedPos.x, adjustedPos.y);
  if (annotation) {
    emit('addAnnotation', annotation);
  }

  startPos.value = null;
}

/**
 * ステージクリック（背景クリック時の選択解除）
 */
function handleStageClick(e: KonvaMouseEvent) {
  if (e.target === e.target.getStage()) {
    selectedAnnotationId.value = null;
  }
}

/**
 * 描画プレビューを更新
 */
function updateDrawingPreview(endX: number, endY: number) {
  if (!startPos.value) return;

  const deltaX = endX - startPos.value.x;
  const deltaY = endY - startPos.value.y;

  if (props.drawingType === 'highlight' || props.drawingType === 'box') {
    drawingPreview.value = {
      rect: {
        x: Math.min(startPos.value.x, endX),
        y: Math.min(startPos.value.y, endY),
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        fill: props.drawingType === 'highlight' ? props.selectedColor : 'transparent',
        opacity: props.drawingType === 'highlight' ? 0.3 : 1,
        stroke: props.drawingType === 'box' ? props.selectedColor : 'transparent',
        strokeWidth: props.drawingType === 'box' ? 2 : 0,
      },
    };
  } else if (props.drawingType === 'line') {
    drawingPreview.value = {
      line: {
        x: startPos.value.x,
        y: startPos.value.y,
        points: [0, 0, deltaX, deltaY],
        stroke: props.selectedColor,
        strokeWidth: 2,
      },
    };
  } else if (props.drawingType === 'circle') {
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
    drawingPreview.value = {
      circle: {
        x: startPos.value.x + deltaX / 2,
        y: startPos.value.y + deltaY / 2,
        radius,
        stroke: props.selectedColor,
        strokeWidth: 2,
      },
    };
  }
}

/**
 * アノテーションを選択
 */
async function selectAnnotation(id: string) {
  selectedAnnotationId.value = id;
  emit('selectAnnotation', id);

  await nextTick(() => {
    attachTransformer(id);
  });
}

/**
 * トランスフォーマーをアタッチ
 */
function attachTransformer(annotationId: string) {
  if (!stageRef.value) return;

  const stage = stageRef.value.getStage();
  const layer = stage.getLayers()[0];

  if (!layer) return;

  // IDでシェイプを検索
  const shape = layer.findOne((node: Node<NodeConfig>) => {
    const attrs = (node as Konva.Shape).getAttrs?.();
    return attrs?.id === annotationId;
  });

  if (shape) {
    transformerConfig.nodes = [shape];
    layer.draw();
  }
}

/**
 * アノテーションを更新
 */
function updateAnnotation(annotation: Annotation) {
  emit('updateAnnotation', annotation);
}

/**
 * アノテーションを削除
 */
function deleteAnnotation(id: string) {
  emit('deleteAnnotation', id);
  if (selectedAnnotationId.value === id) {
    selectedAnnotationId.value = null;
  }
}

/**
 * 設定変更の監視
 */
watch(
  () => props.drawingType,
  (newType) => {
    annotationDrawingManager.setDrawingType(newType);
  },
);

watch(
  () => props.selectedColor,
  (newColor) => {
    annotationDrawingManager.setColor(newColor);
  },
);

watch(
  () => props.pageNumber,
  (newPage) => {
    annotationDrawingManager.setPageNumber(newPage);
  },
);
</script>

<style scoped lang="scss">
.annotation-layer-wrapper {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 10;
  width: 100%;
  height: 100%;

  :deep(canvas) {
    cursor: crosshair;
  }
}
</style>

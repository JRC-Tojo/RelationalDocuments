<template>
  <div class="annotation-layer-wrapper">
    <v-stage
      ref="stageRef"
      :config="canvasSize"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @click="handleStageClick"
      :style="{ cursor: cursorStyle }"
    >
      <v-layer>
        <!-- TODO: アノテーションが増えても管理しやすいようにリファクタリング -->
        <template v-for="annotation in annotations">
          <!-- ハイライトアノテーション -->
          <HighlightAnnotation
            v-if="annotation.type === 'highlight'"
            :key="annotation.id"
            :annotation="annotation"
            :is-selected="selectedIds.has(annotation.id)"
            :is-editing="isEditing"
            @select="selectAnnotation"
            @update="updateAnnotation"
            @delete="deleteAnnotation"
          />

          <!-- ボックスアノテーション -->
          <BoxAnnotation
            v-if="annotation.type === 'box'"
            :key="annotation.id"
            :annotation="annotation"
            :is-selected="selectedIds.has(annotation.id)"
            :is-editing="isEditing"
            @select="selectAnnotation"
            @update="updateAnnotation"
            @delete="deleteAnnotation"
          />

          <!-- 線アノテーション -->
          <LineAnnotation
            v-if="annotation.type === 'line'"
            :key="annotation.id"
            :annotation="annotation"
            :is-selected="selectedIds.has(annotation.id)"
            :is-editing="isEditing"
            @select="selectAnnotation"
            @update="updateAnnotation"
            @delete="deleteAnnotation"
          />

          <!-- 円アノテーション -->
          <CircleAnnotation
            v-if="annotation.type === 'circle'"
            :key="annotation.id"
            :annotation="annotation"
            :is-selected="selectedIds.has(annotation.id)"
            :is-editing="isEditing"
            @select="selectAnnotation"
            @update="updateAnnotation"
            @delete="deleteAnnotation"
          />
        </template>

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
        <v-transformer v-if="isEditing" :config="transformerConfig" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, reactive, computed } from 'vue';
import HighlightAnnotation from './HighlightAnnotation.vue';
import BoxAnnotation from './BoxAnnotation.vue';
import LineAnnotation from './LineAnnotation.vue';
import CircleAnnotation from './CircleAnnotation.vue';
import type { Annotation, AnnotationType } from 'src/models/schemas';
import type Konva from 'konva';
import type { Node, NodeConfig } from 'konva/lib/Node';
import { startDrawingAnnotation } from './annotationDrawingManager';

// Konvaイベント型定義
type KonvaMouseEvent = Konva.KonvaEventObject<MouseEvent>;

interface Props {
  annotations:Annotation[]
  documentId: string;
}
const props = defineProps<Props>();

const page = defineModel<number>('page', { required: true });
const canvasSize = defineModel<{ width: number; height: number }>('canvasSize', { required: true });
const drawingType = defineModel<AnnotationType | 'default'>('drawingType', { required: true });
const scale = defineModel<number>('scale', { required: true });

const emit = defineEmits<{
  addAnnotation: [annotation: Annotation];
  updateAnnotation: [annotation: Annotation];
  deleteAnnotation: [id: string];
}>();

const stageRef = ref<Konva.Stage | null>(null);
const isDrawing = ref(false);
const startPos = ref<{ x: number; y: number } | null>(null);
const selectedIds = ref(new Set());
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
const isEditing = computed(() => drawingType.value !== 'default');
const cursorStyle = computed(() => (isEditing.value ? 'crosshair' : 'default'));
const DEFAULT_COLOR = '#FFD700';
// Transformerの設定。nodes プロパティで制御する
const transformerConfig = reactive({
  nodes: [] as Node<NodeConfig>[],
});

let endDrawingAnnotation: ((endX: number, endY: number) => Annotation | null) | undefined;

/**
 * マウスダウンイベント
 */
function handleMouseDown(e: KonvaMouseEvent) {
  // 編集モードが有効でない場合はスキップ
  if (drawingType.value === 'default') {
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
  const adjustedPos = {
    x: pos.x / scale.value,
    y: pos.y / scale.value,
  };

  isDrawing.value = true;
  startPos.value = adjustedPos;
  endDrawingAnnotation = startDrawingAnnotation(
    props.documentId,
    page.value,
    adjustedPos.x,
    adjustedPos.y,
    drawingType.value,
  );
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
  const adjustedPos = {
    x: pos.x / scale.value,
    y: pos.y / scale.value,
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
  const adjustedPos = {
    x: pos.x / scale.value,
    y: pos.y / scale.value,
  };

  isDrawing.value = false;
  drawingPreview.value = null;

  if (endDrawingAnnotation) {
    const annotation = endDrawingAnnotation(adjustedPos.x, adjustedPos.y);
    if (annotation) {
      emit('addAnnotation', annotation);
    }
  }

  startPos.value = null;
}

/**
 * ステージクリック（背景クリック時の選択解除）
 */
function handleStageClick(e: KonvaMouseEvent) {
  if (e.target === e.target.getStage()) {
    selectedIds.value.clear();
  }
}

/**
 * 描画プレビューを更新
 */
function updateDrawingPreview(endX: number, endY: number) {
  if (!startPos.value) return;

  const deltaX = endX - startPos.value.x;
  const deltaY = endY - startPos.value.y;

  if (drawingType.value === 'highlight' || drawingType.value === 'box') {
    drawingPreview.value = {
      rect: {
        x: Math.min(startPos.value.x, endX),
        y: Math.min(startPos.value.y, endY),
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        fill: drawingType.value === 'highlight' ? DEFAULT_COLOR : 'transparent',
        opacity: drawingType.value === 'highlight' ? 0.3 : 1,
        stroke: drawingType.value === 'box' ? DEFAULT_COLOR : 'transparent',
        strokeWidth: drawingType.value === 'box' ? 2 : 0,
      },
    };
  } else if (drawingType.value === 'line') {
    drawingPreview.value = {
      line: {
        x: startPos.value.x,
        y: startPos.value.y,
        points: [0, 0, deltaX, deltaY],
        stroke: DEFAULT_COLOR,
        strokeWidth: 2,
      },
    };
  } else if (drawingType.value === 'circle') {
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
    drawingPreview.value = {
      circle: {
        x: startPos.value.x + deltaX / 2,
        y: startPos.value.y + deltaY / 2,
        radius,
        stroke: DEFAULT_COLOR,
        strokeWidth: 2,
      },
    };
  }
}

/**
 * アノテーションを選択
 */
async function selectAnnotation(id: string) {
  selectedIds.value.add(id);

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
  selectedIds.value.delete(id);
}
</script>

<style scoped lang="scss">
.annotation-layer-wrapper {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 10;
  width: 100%;
  height: 100%;
}
</style>

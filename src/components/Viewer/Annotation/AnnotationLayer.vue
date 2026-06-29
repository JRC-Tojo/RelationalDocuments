<template>
  <div v-show="editorStore.visibleAnnotations" class="annotation-layer-wrapper">
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
        <template v-for="(annotation, i) in annotations">
          <!-- ボックスアノテーション -->
          <BoxAnnotation
            ref="boxRefs"
            v-if="annotation.type === 'box'"
            :key="annotation.id"
            :annotation="annotation"
            :is-editing="isEditing"
            @update="(newAnnot) => updateAnnotation(newAnnot, i)"
            @delete="deleteAnnotation(i)"
          />

          <!-- 線アノテーション -->
          <LineAnnotation
            ref="lineRefs"
            v-if="annotation.type === 'line'"
            :key="annotation.id"
            :annotation="annotation"
            :is-editing="isEditing"
            @update="(newAnnot) => updateAnnotation(newAnnot, i)"
            @delete="deleteAnnotation(i)"
          />

          <!-- 円アノテーション -->
          <CircleAnnotation
            ref="circleRefs"
            v-if="annotation.type === 'circle'"
            :key="annotation.id"
            :annotation="annotation"
            :is-editing="isEditing"
            @update="(newAnnot) => updateAnnotation(newAnnot, i)"
            @delete="deleteAnnotation(i)"
          />
        </template>

        <!-- 描画中のプレビュー -->
        <v-rect
          v-if="isDrawing && drawingPreview && drawingType === 'box'"
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
        <v-transformer ref="transformerRef" v-if="isEditing" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef, watch } from 'vue';
import BoxAnnotation from './BoxAnnotation.vue';
import LineAnnotation from './LineAnnotation.vue';
import CircleAnnotation from './CircleAnnotation.vue';
import type Konva from 'konva';
import { startDrawingAnnotation } from './annotationDrawingManager';
import { useEditorStore } from 'src/stores/editorStore';
import type { AnnotationStyle } from 'src/models/document/pdf.js';

// Konvaイベント型定義
type KonvaMouseEvent = Konva.KonvaEventObject<MouseEvent>;

interface Props {
  annotations: AnnotationStyle[];
}
defineProps<Props>();
const editorStore = useEditorStore();

const page = defineModel<number>('page', { required: true });
const canvasSize = defineModel<{ width: number; height: number }>('canvasSize', { required: true });
const scale = defineModel<number>('scale', { required: true });

const emit = defineEmits<{
  addAnnotation: [newAnnot: AnnotationStyle];
  updateAnnotation: [newAnnot: AnnotationStyle, targetIdx: number];
  deleteAnnotation: [targetIdx: number];
}>();

const stageRef = useTemplateRef<Konva.Stage>('stageRef');
const transformerRef = useTemplateRef<Konva.TransformerConfig>('transformerRef');
const boxRefs = useTemplateRef<Konva.RectConfig[]>('boxRefs');
const lineRefs = useTemplateRef<Konva.LineConfig[]>('lineRefs');
const circleRefs = useTemplateRef<Konva.CircleConfig[]>('circleRefs');
const selectedAnnotIds = ref<number[]>([]);

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
const drawingType = computed(() => editorStore.currentTools);
const isEditing = computed(() => !['hand'].includes(drawingType.value));
const cursorStyle = computed(() => (isEditing.value ? 'crosshair' : 'default'));

let endDrawingAnnotation: ((endX: number, endY: number) => AnnotationStyle | null) | undefined;

/**
 * マウスダウンイベント
 */
function handleMouseDown(e: KonvaMouseEvent) {
  // ポインターモードの場合は新規描画を許可しない
  if (drawingType.value === 'pointer') return;

  // 編集モードが有効でない場合はスキップ
  if (!isEditing.value) return;

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
    page.value,
    adjustedPos.x,
    adjustedPos.y,
    editorStore.currentAnnotationStyle,
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
  // if click on empty area - remove all selections
  if (drawingType.value === 'pointer' && e.target === e.target.getStage()) {
    selectedAnnotIds.value = [];
    return;
  }

  // do nothing if clicked NOT on our rectangles
  if (!e.target.hasName('rect')) {
    return;
  }

  const clickedId = e.target.attrs.id;

  // do we pressed shift or ctrl?
  const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
  const isSelected = selectedAnnotIds.value.includes(clickedId);

  if (!metaPressed && !isSelected) {
    // if no key pressed and the node is not selected
    // select just one
    selectedAnnotIds.value = [clickedId];
  } else if (metaPressed && isSelected) {
    // if we pressed keys and node was selected
    // we need to remove it from selection:
    selectedAnnotIds.value = selectedAnnotIds.value.filter((id) => id !== clickedId);
  } else if (metaPressed && !isSelected) {
    // add the node into selection
    selectedAnnotIds.value = [...selectedAnnotIds.value, clickedId];
  }
}

/**
 * 描画プレビューを更新
 */
function updateDrawingPreview(endX: number, endY: number) {
  if (!startPos.value) return;

  const deltaX = endX - startPos.value.x;
  const deltaY = endY - startPos.value.y;

  const style = editorStore.currentAnnotationStyle;
  if (style.type === 'box') {
    drawingPreview.value = {
      rect: {
        x: Math.min(startPos.value.x, endX),
        y: Math.min(startPos.value.y, endY),
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        fill: 'transparent',
        opacity: style.fillOpacity,
        stroke: style.strokeColor,
        strokeWidth: style.strokeWidth,
      },
    };
  } else if (style.type === 'line') {
    drawingPreview.value = {
      line: {
        x: startPos.value.x,
        y: startPos.value.y,
        points: [0, 0, deltaX, deltaY],
        stroke: style.strokeColor,
        strokeWidth: style.strokeWidth,
      },
    };
  } else if (style.type === 'circle') {
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
    drawingPreview.value = {
      circle: {
        x: startPos.value.x + deltaX / 2,
        y: startPos.value.y + deltaY / 2,
        radius,
        stroke: style.strokeColor,
        strokeWidth: style.strokeWidth,
      },
    };
  }
}

/**
 * アノテーションを更新
 */
function updateAnnotation(annotation: AnnotationStyle, targetIdx: number) {
  emit('updateAnnotation', annotation, targetIdx);
}

/**
 * アノテーションを削除
 */
function deleteAnnotation(targetIdx: number) {
  emit('deleteAnnotation', targetIdx);
}

watch(selectedAnnotIds, () => {
  if (!transformerRef.value) return;
  if (!boxRefs.value) return;
  if (!lineRefs.value) return;
  if (!circleRefs.value) return;

  const refs = [...boxRefs.value, ...lineRefs.value, ...circleRefs.value];
  const nodes = selectedAnnotIds.value
    .map((id) => {
      return refs.find((ref) => ref.getNode().attrs.id === id)?.getNode();
    })
    .filter(Boolean);

  transformerRef.value.getNode().nodes(nodes);
});
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

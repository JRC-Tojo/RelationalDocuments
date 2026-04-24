<template>
  <div class="page-wrapper">
    <canvas ref="canvasRef" class="pdf-canvas" />
    <!-- Konvaアノテーションレイヤー -->
    <AnnotationLayer
      v-if="canvasRendered"
      :document-id="documentId"
      :annotations="currentPageAnnotations"
      v-model:page="page"
      v-model:scale="scale"
      v-model:canvas-size="canvasSize"
      v-model:drawing-type="drawingType"
      @add-annotation="addAnnotation"
      @update-annotation="updateAnnotation"
      @delete-annotation="deleteAnnotation"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import AnnotationLayer from './Annotation/AnnotationLayer.vue';
import { debounce, useQuasar } from 'quasar';
import type { Annotation, AnnotationType } from 'src/models/schemas';

interface Props {
  documentId: string;
  onRender: (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
}
const props = defineProps<Props>();
const page = defineModel<number>('page', { required: true });
const annotations = defineModel<Annotation[]>('annotations', { required: true });
const drawingType = defineModel<AnnotationType | 'default'>('drawingType', { required: true });
const scale = defineModel<number>('scale', { required: true });

const $q = useQuasar();

const canvas = useTemplateRef('canvasRef');
const canvasRendered = ref(false);
const canvasSize = ref({ width: 0, height: 0, scaleX: 1, scaleY: 1 });

const currentPageAnnotations = computed(() => {
  return annotations.value.filter((a) => a.pageNumber === page.value);
});

async function render(scale: number) {
  if (canvas.value === null) return;
  await props.onRender(page.value, canvas.value, scale);
  canvasSize.value = {
    width: canvas.value.width,
    height: canvas.value.height,
    scaleX: scale,
    scaleY: scale,
  };
}

// ================= TODO: 暫定実装（本来はコマンド化して呼び出し）=================
function addAnnotation(annotation: Annotation) {
  annotations.value.push(annotation);
}

function updateAnnotation(annotation: Annotation) {
  const targetIdx = annotations.value.findIndex((a) => a.id === annotation.id);
  if (targetIdx === -1) return;
  annotations.value[targetIdx] = annotation;
}

function deleteAnnotation(id: string) {
  const targetIdx = annotations.value.findIndex((a) => a.id === id);
  if (targetIdx === -1) return;
  annotations.value.splice(targetIdx, 1);
}
// ================= TODO: 暫定実装（本来はコマンド化して呼び出し）=================

onMounted(async () => {
  try {
    await render(scale.value);
    canvasRendered.value = true;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `ページのレンダリングに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position: 'top',
    });
  }
});

const debouncedRender = debounce((s: number) => void render(s), 100);
watch(scale, (s) => debouncedRender(s));
watch(page, () => void render(scale.value));
</script>

<style lang="scss" scoped>
.pdf-canvas {
  display: block;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-wrapper {
  position: relative;
}
</style>

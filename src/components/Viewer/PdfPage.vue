<template>
  <div
    class="page-wrapper"
    :style="{ transform: `scale(${scale})`, transformOrigin: 'top center' }"
  >
    <canvas ref="canvasRef" class="pdf-canvas" />
    <!-- Konvaアノテーションレイヤー -->
    <AnnotationLayer
      v-if="canvasRendered"
      v-model:annotations="currentPageAnnotations"
      v-model:scale="scale"
      v-model:canvas-size="canvasSize"
      :is-editing="true"
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
import type { PdfDocument } from './pdfManager';
import { renderPage } from './pdfManager';
import type { Annotation } from 'src/models/schemas';

const page = defineModel<number>('page', { required: true });
const doc = defineModel<PdfDocument>('doc', { required: true });
const annotations = defineModel<Annotation[]>('annotations', { required: true });
const scale = defineModel<number>('scale', { required: true });

const $q = useQuasar();

const canvas = useTemplateRef('canvasRef');
const canvasRendered = ref(false);
const canvasSize = computed(() => {
  return { width: canvas.value?.width || 0, height: canvas.value?.height || 0 };
});

const currentPageAnnotations = computed(() => {
  return annotations.value.filter((a) => a.pageNumber === page.value);
});

async function render(scale: number) {
  if (canvas.value === null) return;
  await renderPage(doc.value, page.value, canvas.value, scale);
}

// ================= TODO: 暫定実装（本来はコマンド化して呼び出し）=================
function addAnnotation(annotation: Annotation) {
  annotations.value.push(annotation);
}

function updateAnnotation(annotation: Annotation) {
  const targetIdx = annotations.value.findIndex((a) => a.id === annotation.id);
  annotations.value[targetIdx] = annotation;
}

function deleteAnnotation(id: string) {
  const targetIdx = annotations.value.findIndex((a) => a.id === id);
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

watch(scale, () => debounce(() => render(scale.value)));
watch(page, () => render(scale.value));
</script>

<style lang="scss" scoped>
.pdf-canvas {
  display: block;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>

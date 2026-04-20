<template>
  <div class="pdf-renderer">
    <div v-if="error" class="text-negative q-pa-md">
      {{ error }}
    </div>
    <div v-if="loading" class="loading-indicator">
      <q-spinner size="50px" color="primary" />
    </div>
    <canvas v-show="!error && !loading" ref="canvasRef" class="pdf-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
  src: string;
  page: number;
  scale?: number;
}

const props = withDefaults(defineProps<Props>(), {
  scale: 1,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const error = ref<string>('');
const loading = ref(false);
let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

// PDF.jsワーカーの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

onMounted(async () => {
  await loadPdf();
});

watch(
  () => props.page,
  async () => {
    await renderPage();
  },
);

watch(
  () => props.scale,
  async () => {
    await renderPage();
  },
);

/**
 * PDFファイルを読み込む
 */
async function loadPdf() {
  try {
    error.value = '';
    loading.value = true;

    // URLまたはファイルパスからPDFを読み込む
    const response = await fetch(props.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    await renderPage();
  } catch (err) {
    error.value = `PDFの読み込みに失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
}

/**
 * ページをレンダリング
 */
async function renderPage() {
  try {
    if (!pdfDocument) return;

    loading.value = true;
    if (!canvasRef.value) return;

    const page = await pdfDocument.getPage(props.page);
    const viewport = page.getViewport({ scale: props.scale });

    const canvas = canvasRef.value;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is not available');
    }

    // Canvas のサイズを設定
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // ページをレンダリング
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  } catch (err) {
    error.value = `ページのレンダリングに失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.pdf-renderer {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;

  .pdf-canvas {
    max-width: 100%;
    max-height: 100%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: block;
  }
}
</style>

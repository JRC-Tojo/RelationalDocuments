<template>
  <div class="pdf-editor-page">
    <div
      v-if="onRender !== undefined"
      class="pdf-viewer-container"
      @wheel.prevent="handleZoomWheel"
    >
      <!-- 単一ページまたは見開き表示 -->
      <div v-if="viewMode === 'single'" class="pages-container">
        <PdfPage
          :document-id="documentId"
          v-model:page="currentPage"
          v-model:annotations="annotations"
          v-model:scale="scale"
          @render="onRender"
        />
      </div>

      <!-- 連続表示 -->
      <div v-if="viewMode === 'continuousSingle'" class="continuous-pages">
        <div v-for="page in pageCount" :key="page" class="q-mb-md">
          <PdfPage
            :document-id="documentId"
            :page="page"
            v-model:annotations="annotations"
            v-model:scale="scale"
            @render="onRender"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Annotation, DocumentId } from 'src/models/schemas';
import PdfPage from 'src/components/Viewer/PdfPage.vue';
import type { ViewMode } from 'src/models/docPage';

type RenderFunc = (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
interface Prop {
  documentId: DocumentId;
  pageCount: number;
  viewMode: ViewMode;
  onRender: RenderFunc;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
const prop = defineProps<Prop>();

const annotations = defineModel<Annotation[]>('annotations', { required: true });
const currentPage = defineModel<number>('currentPage', { required: true });
const zoomLevel = defineModel<number>('zoomLevel', { required: true });

// ズーム制御
const scale = computed(() => zoomLevel.value / 100);

/**
 * ズームをホイールで制御
 */
function handleZoomWheel(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault();
    if (event.deltaY < 0) {
      prop.onZoomIn();
    } else {
      prop.onZoomOut();
    }
  }
}
</script>

<style scoped lang="scss">
.pdf-editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.pdf-viewer-container {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  .pages-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  .continuous-pages {
    width: 100%;
    max-width: 900px;
  }
}
</style>

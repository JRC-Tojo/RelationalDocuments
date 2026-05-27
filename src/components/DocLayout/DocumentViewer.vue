<template>
  <div class="pdf-editor-page">
    <div
      v-if="onRender !== undefined"
      class="pdf-viewer-container"
      @wheel="handleZoomWheel"
      ref="viewerContainer"
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
      <div
        v-if="viewMode === 'continuousSingle'"
        class="continuous-pages"
        ref="continuousContainer"
      >
        <div v-for="page in pageCount" :key="page" class="q-mb-md continuous-page-wrapper">
          <div
            :class="['continuous-page', { active: page === currentPage }]"
            :ref="
              (el) => {
                if (el) pageRefs[page - 1] = el as HTMLElement;
              }
            "
          >
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue';
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

// 連続表示モード用
const pageRefs = ref<(HTMLElement | null)[]>([]);
const continuousContainer = ref<HTMLElement>();
const viewerContainer = ref<HTMLElement>();

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

/**
 * 連続表示モード時に現在ページをビューにスクロール
 */
async function scrollToCurrentPage() {
  if (prop.viewMode !== 'continuousSingle') return;

  await nextTick();

  const pageElement = pageRefs.value[currentPage.value - 1];
  if (pageElement && continuousContainer.value) {
    // ページ要素がビューポートの中央になるようにスクロール
    const containerRect = continuousContainer.value.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();

    const scrollTop = continuousContainer.value.scrollTop;
    const scrollOffset = pageRect.top - containerRect.top;

    continuousContainer.value.scrollTo({
      top: scrollTop + scrollOffset - (containerRect.height / 2 - pageRect.height / 2),
      behavior: 'smooth',
    });
  }
}

watch(currentPage, () => {
  void scrollToCurrentPage();
});

watch(
  () => prop.viewMode,
  () => {
    if (prop.viewMode === 'continuousSingle') {
      void nextTick(() => {
        void scrollToCurrentPage();
      });
    }
  },
);
</script>

<style scoped lang="scss">
.pdf-editor-page {
  height: 100%;
  width: 100%;
  background: $grey-1;
}

.body--dark .pdf-editor-page {
  background: darken($dark, 5%);
}

.pdf-viewer-container {
  margin: 10pt;
  background: $grey-1;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: $grey-2;
  }

  &::-webkit-scrollbar-thumb {
    background: $grey-4;
    border-radius: 4px;

    &:hover {
      background: $grey-5;
    }
  }

  .pages-container {
    margin: auto;
    max-width: fit-content;
  }

  .continuous-pages {
    margin: auto;
    max-width: fit-content;
    display: flex;
    flex-direction: column;

    .continuous-page-wrapper {
      width: 100%;
    }
  }
}

.body--dark .pdf-viewer-container {
  background: darken($dark, 5%);

  &::-webkit-scrollbar-track {
    background: $grey-8;
  }

  &::-webkit-scrollbar-thumb {
    background: $grey-7;

    &:hover {
      background: $grey-6;
    }
  }

  .continuous-pages {
    .continuous-page-wrapper {
      .continuous-page {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);

        &.active {
          box-shadow: 0 4px 16px rgba(25, 118, 210, 0.4);
        }

        &:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        }
      }
    }
  }
}
</style>

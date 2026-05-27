<template>
  <div class="document-layout">
    <!-- 左Drawer：ドキュメント情報とサムネイル -->
    <DocumentLeftDrawer
      v-model:drawer-open="editorStore.leftDrawerModel"
      :total-page-count="pageCount"
      :current-page="currentPage"
      :thumnails="thumbnails"
      @go-to-page="goToPage"
    />

    <!-- メインコンテンツ領域 -->
    <div class="document-main-content">
      <!-- タブコンテンツ：文書とアノテーション表示 -->
      <div class="document-viewer-wrapper">
        <DocumentViewer
          v-if="!loading && onRender"
          :document-id="documentId"
          :page-count="pageCount"
          :view-mode="viewMode"
          @render="onRender"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          v-model:annotations="annotations"
          v-model:current-page="currentPage"
          v-model:zoom-level="zoomLevel"
        />
        <div v-else-if="loading" class="loading-state">
          <q-spinner color="primary" size="3em" />
          <p class="q-mt-md">{{ $t('loading') }}</p>
        </div>
      </div>

      <!-- フッター：ページネーション、ズーム等 -->
      <DocumentFooter
        v-model:current-page="currentPage"
        v-model:view-mode="viewMode"
        v-model:zoom-level="zoomLevel"
        :total-page-count="pageCount"
        :scale="zoomLevel"
        @go-to-first-page="goToFirstPage"
        @previous-page="previousPage"
        @next-page="nextPage"
        @go-to-last-page="goToLastPage"
        @go-to-page="goToPage"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
      />
    </div>

    <!-- 右Drawer：アノテーションプロパティ -->
    <DocumentRightDrawer
      v-model:drawer-open="editorStore.rightDrawerModel"
      v-model:selected-ant="selectedAnnotations"
    />
  </div>
</template>

<script setup lang="ts">
import DocumentLeftDrawer from 'src/components/DocLayout/DocumentLeftDrawer.vue';
import DocumentViewer from 'src/components/DocLayout/DocumentViewer.vue';
import DocumentRightDrawer from 'src/components/DocLayout/DocumentRightDrawer.vue';
import DocumentFooter from 'src/components/DocLayout/DocumentFooter.vue';
import { onMounted, ref, watch } from 'vue';
import { useBackendApi } from 'src/apis/backendApi';
import { generateThumbnail, loadPdf, renderPage } from '../Viewer/pdfManager';
import type { Annotation, DocumentId } from 'src/models/schemas';
import type { ViewMode } from 'src/models/docPage';
import { useEditorStore } from 'src/stores/editorStore';
import { callEditorTools } from 'src/stores/editorTools';

const editorStore = useEditorStore();

const documentId = defineModel<DocumentId>({ required: true });
const loading = ref<boolean>(true);

// for drawers
const thumbnails = ref<string[]>([]);

// for document
type RenderFunc = (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
const onRender = ref<RenderFunc>();
const annotations = ref<Annotation[]>([]);
const selectedAnnotations = ref<Annotation[]>([]);
const currentPage = ref(1);
const pageCount = ref(0);

// for footer
const zoomLevel = ref(100);
const viewMode = ref<ViewMode>('single');

// ================================

function clearDocument() {
  currentPage.value = 1;
  pageCount.value = 0;
  onRender.value = undefined;
  thumbnails.value = [];
  annotations.value = [];
}

async function loadDocument(docId: string) {
  loading.value = true;

  const api = useBackendApi();
  const doc = await api.getDocument(docId);
  if (!doc.success || !doc.data) {
    loading.value = false;
    return;
  }

  // PDFファイルを読み込む
  const loadDocument = await loadPdf(doc.data.filePath);
  pageCount.value = loadDocument.numPages;

  // レンダリング関数を設定
  onRender.value = async (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<void> => {
    return await renderPage(loadDocument, pageNumber, canvas, scale);
  };

  // サムネイルを生成
  thumbnails.value = await Promise.all(
    Array.from({ length: pageCount.value }, (_, idx) =>
      generateThumbnail(loadDocument, idx + 1, 120),
    ),
  );

  // PDFマネージャーからアノテーションを読み込む
  const annotationRes = await api.getAnnotationsByDocument(documentId.value);
  if (annotationRes.success) annotations.value = annotationRes.data || [];

  loading.value = false;
}

// ================================

/**
 * ズームレベルを設定
 */
const setZoomLevel = (level: number): void => {
  const MIN_ZOOM = 20;
  const MAX_ZOOM = 800;
  zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
};

/**
 * ズームイン
 */
const zoomIn = (step: number = 5): void => {
  setZoomLevel(zoomLevel.value + step);
};

/**
 * ズームアウト
 */
const zoomOut = (step: number = 5): void => {
  setZoomLevel(zoomLevel.value - step);
};

// ================================

/**
 * 最初のページへ移動
 */
const goToFirstPage = (): void => {
  currentPage.value = 1;
};

/**
 * 前のページへ移動
 */
const previousPage = (): void => {
  currentPage.value = Math.max(1, currentPage.value - 1);
};

/**
 * 指定したページへ移動
 */
const goToPage = (page: number): void => {
  currentPage.value = Math.max(1, Math.min(pageCount.value, page));
};

/**
 * 次のページへ移動
 */
const nextPage = (): void => {
  currentPage.value = Math.min(pageCount.value, currentPage.value + 1);
};

/**
 * 最後のページへ移動
 */
const goToLastPage = (): void => {
  currentPage.value = pageCount.value;
};

// ================================

onMounted(async () => {
  editorStore.initStore(await callEditorTools());
  await loadDocument(documentId.value);
});

watch(documentId, async (newDocId) => {
  clearDocument();
  await loadDocument(newDocId);
});
</script>

<style scoped lang="scss">
.document-layout {
  display: flex;
  height: 100%;
  width: 100%;
  background: white;
  overflow: hidden;
}

.body--dark .document-layout {
  background: $dark;
}

.document-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: $grey-1;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.body--dark .document-main-content {
  background: darken($dark, 5%);
}

.document-viewer-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $grey-1;
  width: 100%;
}

.body--dark .document-viewer-wrapper {
  background: darken($dark, 5%);
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $grey-1;
}

.body--dark .loading-state {
  background: darken($dark, 5%);
}
</style>

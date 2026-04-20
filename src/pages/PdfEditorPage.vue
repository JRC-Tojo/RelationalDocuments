<template>
  <q-page v-if="document" class="pdf-editor-page">
    <!-- ツールバー -->
    <div class="editor-toolbar bg-white shadow-1">
      <div class="row items-center q-pa-md gap-md">
        <q-btn flat icon="arrow_back" @click="$router.back()" />
        <h1 class="text-h5 q-my-none">{{ document.title }}</h1>
        <q-space />

        <!-- ビューモード選択 -->
        <div class="row items-center gap-md">
          <span class="text-body2 text-grey">{{ $t('pdfEditor.viewMode') }}:</span>
          <q-option-group v-model="viewMode" :options="viewModeOptions" color="primary" inline />
        </div>

        <!-- ズーム操作 -->
        <div class="row items-center gap-sm">
          <q-btn flat dense icon="zoom_out" @click="decreaseZoom" />
          <q-input
            :model-value="zoomLevel"
            type="number"
            outlined
            dense
            style="width: 80px"
            @update:model-value="(val) => validateZoom(val as number | null)"
            suffix="%"
          />
          <q-btn flat dense icon="zoom_in" @click="increaseZoom" />
          <q-btn flat dense icon="zoom_to_fit" @click="fitToPage" />
        </div>

        <q-separator vertical class="q-mx-md" />

        <!-- アノテーションツール -->
        <div class="row items-center gap-sm">
          <q-btn
            v-for="tool in annotationTools"
            :key="tool.id"
            flat
            dense
            :icon="tool.icon"
            :title="tool.label"
            :color="selectedTool === tool.id ? 'primary' : 'grey-7'"
            @click="selectTool(tool.id as AnnotationType)"
          />
        </div>

        <q-separator vertical class="q-mx-md" />

        <!-- 色選択 -->
        <div class="row items-center gap-sm">
          <span class="text-body2 text-grey">{{ $t('pdfEditor.color') }}:</span>
          <div class="row gap-xs">
            <button
              v-for="color in colorPalette"
              :key="color"
              class="color-swatch"
              :style="{
                backgroundColor: color,
                borderColor: selectedColor === color ? '#000' : '#ccc',
              }"
              :title="color"
              @click="selectedColor = color"
            />
          </div>
        </div>

        <q-separator vertical class="q-mx-md" />

        <q-btn
          flat
          icon="save"
          :label="$t('button.save')"
          color="positive"
          @click="saveAnnotations"
        />
      </div>
    </div>

    <!-- メインエディタエリア -->
    <div class="editor-container">
      <!-- 左サイドバー -->
      <div class="left-sidebar bg-white shadow-1">
        <q-tabs
          v-model="leftTabActive"
          vertical
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="thumbnails" icon="image" :label="$t('pdfEditor.thumbnails')" />
          <q-tab name="bookmarks" icon="bookmark" :label="$t('pdfEditor.bookmarks')" />
        </q-tabs>

        <q-tab-panels v-model="leftTabActive" animated class="left-panel-content">
          <!-- サムネイル一覧 -->
          <q-tab-panel name="thumbnails" class="q-pa-md">
            <div class="thumbnails-list">
              <div
                v-for="(thumb, index) in thumbnails"
                :key="index"
                class="thumbnail-item"
                :class="{ active: currentPage === index + 1 }"
                @click="goToPage(index + 1)"
              >
                <img :src="thumb" :alt="`Page ${index + 1}`" />
                <div class="page-number">{{ index + 1 }}</div>
              </div>
            </div>
          </q-tab-panel>

          <!-- ブックマーク一覧 -->
          <q-tab-panel name="bookmarks" class="q-pa-md">
            <div v-if="bookmarks.length > 0" class="bookmarks-list">
              <div
                v-for="(bookmark, index) in bookmarks"
                :key="index"
                class="bookmark-item"
                @click="goToPage(bookmark.pageNumber)"
              >
                <q-icon name="bookmark" class="q-mr-sm" />
                <div class="bookmark-content">
                  <div class="text-subtitle2">{{ bookmark.title }}</div>
                  <div class="text-caption text-grey">
                    {{ $t('pdfEditor.page') }} {{ bookmark.pageNumber }}
                  </div>
                </div>
                <q-btn flat dense size="sm" icon="close" @click.stop="removeBookmark(index)" />
              </div>
            </div>
            <div v-else class="text-center text-grey q-mt-md">
              {{ $t('pdfEditor.noBookmarks') }}
            </div>
            <q-btn
              flat
              class="full-width q-mt-md"
              icon="add"
              :label="$t('pdfEditor.addBookmark')"
              size="sm"
              @click="addBookmarkDialog"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- PDF表示エリア -->
      <div class="pdf-display-area">
        <div class="pdf-viewer-container" @wheel.prevent="handleZoomWheel">
          <!-- 単一ページまたは見開き表示 -->
          <div v-if="viewMode === 'single' || viewMode === 'spread'" class="pages-container">
            <!-- 最初のページ -->
            <div
              class="page-wrapper"
              :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"
            >
              <canvas ref="canvasRef" class="pdf-canvas" :width="pageWidth" :height="pageHeight" />
              <!-- Konvaアノテーションレイヤー -->
              <AnnotationLayer
                :annotations="currentPageAnnotations"
                :drawing-type="selectedTool"
                :selected-color="selectedColor"
                :page-number="currentPage"
                :canvas-width="pageWidth"
                :canvas-height="pageHeight"
                :zoom-level="zoomLevel"
                :is-editing="true"
                @add-annotation="addAnnotation"
                @update-annotation="updateAnnotation"
                @delete-annotation="deleteAnnotation"
                @select-annotation="selectAnnotation"
              />
            </div>

            <!-- 見開き表示の場合、右ページ -->
            <div
              v-if="viewMode === 'spread' && currentPage < pageCount"
              class="page-wrapper q-ml-md"
            >
              <canvas
                ref="canvasRefRight"
                class="pdf-canvas"
                :width="pageWidth"
                :height="pageHeight"
              />
            </div>
          </div>

          <!-- 連続表示 -->
          <div v-if="viewMode === 'continuous'" class="continuous-pages">
            <div v-for="page in pageCount" :key="page" class="page-wrapper q-mb-md">
              <canvas
                :ref="
                  (el) => {
                    if (el) continuousCanvases.push(el as HTMLCanvasElement);
                  }
                "
                class="pdf-canvas"
                :width="pageWidth"
                :height="pageHeight"
              />
            </div>
          </div>
        </div>

        <!-- ページナビゲーション -->
        <div class="page-navigation bg-white shadow-1">
          <div class="row items-center justify-center gap-md q-pa-md">
            <q-btn flat icon="navigate_before" @click="previousPage" :disable="currentPage === 1" />
            <div class="row items-center gap-sm">
              <span>{{ $t('pdfEditor.page') }}:</span>
              <q-input
                :model-value="currentPage"
                type="number"
                outlined
                dense
                style="width: 80px"
                @update:model-value="(val) => validatePageNumber(val)"
                min="1"
                :max="pageCount"
              />
              <span>/ {{ pageCount }}</span>
            </div>
            <q-btn
              flat
              icon="navigate_next"
              @click="nextPage"
              :disable="currentPage === pageCount"
            />
          </div>
        </div>
      </div>

      <!-- 右サイドバー -->
      <div class="right-sidebar bg-white shadow-1">
        <q-tabs
          v-model="rightTabActive"
          vertical
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="annotations" icon="edit" :label="$t('pdfEditor.annotations')" />
          <q-tab name="info" icon="info" :label="$t('document.title')" />
        </q-tabs>

        <q-tab-panels v-model="rightTabActive" animated class="right-panel-content">
          <!-- アノテーション一覧 -->
          <q-tab-panel name="annotations" class="q-pa-md">
            <div v-if="currentPageAnnotations.length > 0" class="annotations-list">
              <div
                v-for="annotation in currentPageAnnotations"
                :key="annotation.id"
                class="annotation-item q-mb-md p-md bg-grey-2 rounded"
                :class="{ selected: selectedAnnotationId === annotation.id }"
                @click="selectAnnotation(annotation.id)"
              >
                <div class="row items-center justify-between q-mb-sm">
                  <div class="row items-center gap-sm">
                    <div class="color-box" :style="{ backgroundColor: annotation.color }" />
                    <span class="text-weight-bold">{{ annotation.type }}</span>
                  </div>
                  <q-btn
                    flat
                    dense
                    size="sm"
                    icon="delete"
                    color="negative"
                    @click.stop="deleteAnnotation(annotation.id)"
                  />
                </div>
                <div v-if="annotation.content" class="text-body2 text-grey-8 q-mt-sm">
                  {{ annotation.content }}
                </div>
              </div>
            </div>
            <div v-else class="text-center text-grey">
              {{ $t('pdfEditor.noAnnotations') }}
            </div>
          </q-tab-panel>

          <!-- ドキュメント情報 -->
          <q-tab-panel name="info" class="q-pa-md">
            <div class="info-section q-mb-md">
              <div class="text-weight-bold q-mb-sm">{{ $t('document.title') }}</div>
              <div class="text-body2">{{ document.title }}</div>
            </div>
            <div class="info-section q-mb-md">
              <div class="text-weight-bold q-mb-sm">{{ $t('document.pages') }}</div>
              <div class="text-body2">{{ pageCount }}</div>
            </div>
            <div class="info-section q-mb-md">
              <div class="text-weight-bold q-mb-sm">{{ $t('document.uploadedAt') }}</div>
              <div class="text-body2">{{ formatDate(document.uploadedAt) }}</div>
            </div>
            <div v-if="document.genre" class="info-section q-mb-md">
              <div class="text-weight-bold q-mb-sm">{{ $t('document.genre') }}</div>
              <div class="text-body2">{{ document.genre }}</div>
            </div>
            <div v-if="document.tags && document.tags.length > 0" class="info-section">
              <div class="text-weight-bold q-mb-sm">{{ $t('document.tags') }}</div>
              <div class="row gap-xs">
                <q-chip v-for="tag in document.tags" :key="tag" size="sm" removable>
                  {{ tag }}
                </q-chip>
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>
  </q-page>

  <q-page v-else class="flex items-center justify-center">
    <q-spinner size="50px" color="primary" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useBackendApi } from 'src/apis/backendApi';
import { pdfManager } from 'src/services/pdfService';
import { annotationDrawingManager } from 'src/components/Viewer/Annotation/annotationDrawingManager';
import type { DocumentMetadata, Annotation, AnnotationType } from 'src/models/schemas';
import AnnotationLayer from 'src/components/Viewer/Annotation/AnnotationLayer.vue';

interface Bookmark {
  pageNumber: number;
  title: string;
}

const route = useRoute();
const { t: $t } = useI18n();
const $q = useQuasar();
const api = useBackendApi();

// ドキュメント情報
const document = ref<DocumentMetadata | null>(null);
const documentId = computed(() => route.params.id as string);

// 表示制御
const viewMode = ref<'single' | 'continuous' | 'spread'>('single');
const viewModeOptions = [
  { label: $t('pdfEditor.singlePage'), value: 'single' },
  { label: $t('pdfEditor.continuous'), value: 'continuous' },
  { label: $t('pdfEditor.twoPages'), value: 'spread' },
];

// ズーム制御
const zoomLevel = ref(100);
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;

// ページ制御
const currentPage = ref(1);
const pageCount = ref(1);
const pageWidth = 800;
const pageHeight = 1000;

// キャンバス参照
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasRefRight = ref<HTMLCanvasElement | null>(null);
const continuousCanvases = ref<HTMLCanvasElement[]>([]);

// アノテーション制御
const annotations = ref<Annotation[]>([]);
const selectedAnnotationId = ref<string | null>(null);
const selectedTool = ref<AnnotationType>('highlight');
const selectedColor = ref('#FFD700');

// アンドゥ・リドゥ履歴
const annotationHistory = ref<Annotation[][]>([]);
const historyIndex = ref(-1);

const annotationTools = [
  { id: 'highlight', icon: 'format_color_highlight', label: 'Highlight' },
  { id: 'line', icon: 'edit', label: 'Line' },
  { id: 'box', icon: 'crop_square', label: 'Box' },
  { id: 'circle', icon: 'radio_button_unchecked', label: 'Circle' },
];

const colorPalette = [
  '#FFD700', // Gold
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

// サイドバー制御
const leftTabActive = ref('thumbnails');
const rightTabActive = ref('annotations');
const thumbnails = ref<string[]>([]);
const bookmarks = ref<Bookmark[]>([]);

// 計算プロパティ
const currentPageAnnotations = computed(() => {
  return annotations.value.filter((a) => a.pageNumber === currentPage.value);
});

onMounted(async () => {
  await loadDocument();
  loadBookmarksFromStorage();
  await initializePdf();

  // キーボードショートカットの登録
  window.addEventListener('keydown', handleKeyboardShortcut);
});

onBeforeUnmount(() => {
  pdfManager.cleanup();
  annotationDrawingManager.destroy();
  // キーボードイベントリスナーの削除
  window.removeEventListener('keydown', handleKeyboardShortcut);
});

watch(currentPage, async () => {
  await renderCurrentPage();
});

watch(viewMode, async () => {
  await nextTick(async () => {
    await renderCurrentPage();
  });
});

watch(selectedTool, () => {
  annotationDrawingManager.setDrawingType(selectedTool.value);
});

watch(selectedColor, () => {
  annotationDrawingManager.setColor(selectedColor.value);
});

watch(currentPage, () => {
  annotationDrawingManager.setPageNumber(currentPage.value);
});

/**
 * ドキュメント情報を読み込む
 */
async function loadDocument() {
  const response = await api.getDocument(documentId.value);
  if (response.success && response.data) {
    document.value = response.data;
    pageCount.value = response.data.pageCount;
    // アノテーション描画マネージャーにドキュメントIDを設定
    annotationDrawingManager.setDocumentId(documentId.value);
  }
}

/**
 * PDF を初期化
 */
async function initializePdf() {
  try {
    if (!document.value?.filePath) {
      throw new Error('Document file path is not available');
    }

    // PDFマネージャーからアノテーションを読み込む
    pdfManager.loadAnnotationsFromStorage(documentId.value);

    // PDFファイルを読み込む
    const pdfInfo = await pdfManager.loadPdf(document.value.filePath);
    pageCount.value = pdfInfo.pageCount;

    // サムネイルを生成
    for (let i = 1; i <= pdfInfo.pageCount; i++) {
      const thumbnail = await pdfManager.generateThumbnail(i, 120);
      thumbnails.value.push(thumbnail);
    }

    // 保存されたアノテーションを取得
    const savedAnnotations = pdfManager.getAllAnnotations();
    annotations.value = savedAnnotations;

    // 初回レンダリング
    await renderCurrentPage();
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `PDFの初期化に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position: 'top',
    });
  }
}

/**
 * 現在のページを描画
 */
async function renderCurrentPage() {
  try {
    if (viewMode.value === 'single' || viewMode.value === 'spread') {
      if (canvasRef.value) {
        const scale = zoomLevel.value / 100;
        await pdfManager.renderPage(currentPage.value, canvasRef.value, scale);
      }

      // 見開き表示の場合、右ページも描画
      if (
        viewMode.value === 'spread' &&
        canvasRefRight.value &&
        currentPage.value < pageCount.value
      ) {
        const scale = zoomLevel.value / 100;
        await pdfManager.renderPage(currentPage.value + 1, canvasRefRight.value, scale);
      }
    } else if (viewMode.value === 'continuous') {
      // 連続表示の場合、すべてのページを描画
      continuousCanvases.value = [];
      await nextTick();

      const containerEl = (globalThis as typeof window).document?.querySelector(
        '.continuous-pages',
      );
      if (containerEl) {
        const canvases = containerEl.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i];
          if (canvas) {
            const scale = zoomLevel.value / 100;
            await pdfManager.renderPage(i + 1, canvas, scale);
          }
        }
      }
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `ページのレンダリングに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position: 'top',
    });
  }
}

/**
 * ツールを選択
 */
function selectTool(toolId: AnnotationType) {
  selectedTool.value = toolId;
}

/**
 * ズームをホイールで制御
 */
function handleZoomWheel(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault();
    if (event.deltaY < 0) {
      increaseZoom();
    } else {
      decreaseZoom();
    }
  }
}

/**
 * ズームを増加
 */
function increaseZoom() {
  zoomLevel.value = Math.min(zoomLevel.value + 10, MAX_ZOOM);
}

/**
 * ズームを減少
 */
function decreaseZoom() {
  zoomLevel.value = Math.max(zoomLevel.value - 10, MIN_ZOOM);
}

/**
 * ページに合わせてズーム
 */
function fitToPage() {
  zoomLevel.value = 100;
}

/**
 * ズームレベルを検証
 */
function validateZoom(value: number | string | null) {
  if (value !== null && value !== undefined && value !== '') {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(numValue)) {
      zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, numValue));
    }
  }
}

/**
 * ページ番号を検証
 */
function validatePageNumber(value: number | string | null) {
  if (value !== null && value !== undefined && value !== '') {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue)) {
      currentPage.value = Math.max(1, Math.min(pageCount.value, numValue));
    }
  }
}

/**
 * 前のページへ
 */
function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

/**
 * 次のページへ
 */
function nextPage() {
  if (currentPage.value < pageCount.value) {
    currentPage.value++;
  }
}

/**
 * 指定ページへ移動
 */
function goToPage(pageNumber: number) {
  currentPage.value = pageNumber;
}

/**
 * アノテーションを選択
 */
function selectAnnotation(id: string) {
  selectedAnnotationId.value = id;
}

/**
 * アノテーションを保存
 */
function saveAnnotations() {
  try {
    // ローカルストレージに保存
    pdfManager.saveAnnotationsToStorage(documentId.value);

    $q.notify({
      type: 'positive',
      message: $t('message.success'),
      position: 'top',
      timeout: 2000,
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `アノテーションの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position: 'top',
    });
  }
}

/**
 * ブックマークをローカルストレージから読み込む
 */
function loadBookmarksFromStorage() {
  const key = `bookmarks_${documentId.value}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    bookmarks.value = JSON.parse(stored);
  }
}

/**
 * ブックマークをローカルストレージに保存
 */
function saveBookmarksToStorage() {
  const key = `bookmarks_${documentId.value}`;
  localStorage.setItem(key, JSON.stringify(bookmarks.value));
}

/**
 * ブックマークを追加
 */
function addBookmarkDialog() {
  $q.dialog({
    title: $t('pdfEditor.addBookmark'),
    message: $t('pdfEditor.bookmarkTitle'),
    prompt: {
      model: `Page ${currentPage.value}`,
      type: 'text',
    },
    cancel: true,
  }).onOk((data: string) => {
    addBookmark(data);
  });
}

/**
 * アンドゥ履歴に保存
 */
function saveToHistory() {
  // 現在のインデックスより後の履歴を削除（新しい操作を行ったため）
  if (historyIndex.value < annotationHistory.value.length - 1) {
    annotationHistory.value = annotationHistory.value.slice(0, historyIndex.value + 1);
  }
  // 現在の状態を履歴に追加
  annotationHistory.value.push(JSON.parse(JSON.stringify(annotations.value)));
  historyIndex.value++;
}

/**
 * アノテーションを追加
 */
function addAnnotation(annotation: Annotation) {
  annotations.value.push(annotation);
  saveToHistory();
}

/**
 * アノテーションを更新
 */
function updateAnnotation(annotation: Annotation) {
  const index = annotations.value.findIndex((a) => a.id === annotation.id);
  if (index !== -1) {
    annotations.value[index] = annotation;
    saveToHistory();
  }
}

/**
 * アノテーションを削除
 */
function deleteAnnotation(id: string) {
  pdfManager.deleteAnnotation(id);
  annotations.value = pdfManager.getAllAnnotations();
  if (selectedAnnotationId.value === id) {
    selectedAnnotationId.value = null;
  }
  saveToHistory();
}

/**
 * ブックマークを追加
 */
function addBookmark(title: string) {
  bookmarks.value.push({
    pageNumber: currentPage.value,
    title,
  });
  saveBookmarksToStorage();
}

/**
 * ブックマークを削除
 */
function removeBookmark(index: number) {
  bookmarks.value.splice(index, 1);
  saveBookmarksToStorage();
}

/**
 * 日付をフォーマット
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * キーボードショートカット処理
 */
function handleKeyboardShortcut(event: KeyboardEvent) {
  // Ctrl+Z または Cmd+Z でアンドゥ
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  }
  // Ctrl+Shift+Z または Cmd+Shift+Z でリドゥ
  else if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
    event.preventDefault();
    redo();
  }
  // Ctrl+Y または Cmd+Y でリドゥ（別の方法）
  else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    event.preventDefault();
    redo();
  }
  // Delete または Backspace でアノテーション削除
  else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId.value) {
    event.preventDefault();
    deleteAnnotation(selectedAnnotationId.value);
  }
}

/**
 * アンドゥを実行
 */
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    annotations.value = JSON.parse(JSON.stringify(annotationHistory.value[historyIndex.value]));
  }
}

/**
 * リドゥを実行
 */
function redo() {
  if (historyIndex.value < annotationHistory.value.length - 1) {
    historyIndex.value++;
    annotations.value = JSON.parse(JSON.stringify(annotationHistory.value[historyIndex.value]));
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

.editor-toolbar {
  flex-shrink: 0;
  border-bottom: 1px solid #e0e0e0;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;

  .left-sidebar {
    width: 120px;
    overflow-y: auto;
    border-right: 1px solid #e0e0e0;
  }

  .pdf-display-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

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

    .page-navigation {
      border-top: 1px solid #e0e0e0;
    }
  }

  .right-sidebar {
    width: 120px;
    overflow-y: auto;
    border-left: 1px solid #e0e0e0;
  }
}

.page-wrapper {
  position: relative;
  display: inline-block;
  width: fit-content;
  height: fit-content;

  .pdf-canvas {
    display: block;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .annotation-overlay {
    position: absolute;
    top: 0;
    left: 0;

    .annotation-svg {
      display: block;
    }
  }
}

.annotation-element {
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.7 !important;
  }
}

.color-swatch {
  width: 24px;
  height: 24px;
  border: 2px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
}

.color-box {
  width: 16px;
  height: 16px;
  border: 1px solid #ddd;
  border-radius: 2px;
}

.left-panel-content,
.right-panel-content {
  flex: 1;
  overflow-y: auto;
}

.thumbnails-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thumbnail-item {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.2s ease;

  img {
    width: 100%;
    height: auto;
    display: block;
  }

  .page-number {
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 2px 4px;
    font-size: 10px;
    border-radius: 2px;
  }

  &.active {
    border-color: #1976d2;
    box-shadow: 0 0 8px rgba(25, 118, 210, 0.5);
  }

  &:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bookmark-item {
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: #eeeeee;
  }

  .bookmark-content {
    flex: 1;
    min-width: 0;
  }
}

.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-item {
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &.selected {
    border-color: #1976d2;
    background: #e3f2fd !important;
  }

  &:hover {
    background: #f5f5f5 !important;
  }
}

.p-md {
  padding: 12px;
}

.info-section {
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;

  &:last-child {
    border-bottom: none;
  }
}

.gap-md {
  gap: 12px;
}

.gap-sm {
  gap: 8px;
}

.gap-xs {
  gap: 4px;
}
</style>

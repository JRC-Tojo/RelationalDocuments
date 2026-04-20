<template>
  <q-page v-if="document" class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" @click="$router.back()" />
      <h1 class="text-h4 q-my-none q-ml-md">{{ document.title }}</h1>
      <q-space />
      <q-btn
        flat
        icon="history"
        :label="$t('document.viewRevisions')"
        @click="showRevisions = !showRevisions"
      />
    </div>

    <q-splitter v-model="splitterModel" style="height: 800px">
      <!-- PDF表示エリア -->
      <template #before>
        <div class="pdf-viewer bg-grey-1 relative-position">
          <div class="absolute-top-right q-p-md row gap-sm">
            <q-btn flat dense icon="zoom_in" @click="zoomLevel = Math.min(zoomLevel + 10, 200)" />
            <q-btn flat dense icon="zoom_out" @click="zoomLevel = Math.max(zoomLevel - 10, 50)" />
            <q-btn flat dense icon="zoom_to_fit" @click="zoomLevel = 100" />
          </div>

          <div class="pdf-container q-pa-md" :style="{ zoom: `${zoomLevel}%` }">
            <p v-if="!pdfLoaded" class="text-center text-grey">{{ $t('message.loading') }}</p>

            <!-- PDF描画 -->
            <!-- <VuePdfEmbed
                :source="document.filePath"
                annotation-layer
                text-layer
             /> -->

            <!-- マークアップレイヤー -->
            <svg
              v-if="pdfLoaded"
              id="markup-layer"
              class="absolute full-width"
              style="top: 0; left: 0; pointer-events: all"
            >
              <rect
                v-for="markup in currentPageMarkups"
                :key="markup.id"
                :x="markup.x"
                :y="markup.y"
                :width="markup.width"
                :height="markup.height"
                :fill="markup.color"
                :opacity="markup.opacity"
                :stroke-width="2"
                stroke="rgba(0,0,0,0.3)"
                class="markup-rect"
                @click="selectMarkup(markup)"
                style="cursor: pointer"
              />
            </svg>
          </div>
        </div>
      </template>

      <!-- 右パネル -->
      <template #after>
        <!-- タブナビゲーション -->
        <q-tabs
          v-model="tabActive"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="left"
        >
          <q-tab name="markups" :label="$t('markup.title')" icon="draw" />
          <q-tab name="revisions" :label="$t('revision.title')" icon="history" />
          <q-tab name="info" :label="$t('document.title')" icon="info" />
        </q-tabs>

        <q-tab-panels v-model="tabActive" animated>
          <!-- マークアップタブ -->
          <q-tab-panel name="markups" class="q-pa-md">
            <div class="q-mb-md">
              <q-btn
                unelevated
                color="primary"
                :label="$t('markup.createNew')"
                size="sm"
                @click="createNewMarkup"
              />
            </div>

            <div v-if="currentPageMarkups.length > 0" class="markup-list">
              <div
                v-for="markup in currentPageMarkups"
                :key="markup.id"
                class="q-mb-md p-md bg-grey-2 rounded"
                @click="selectMarkup(markup)"
                style="cursor: pointer"
              >
                <div class="row items-center justify-between q-mb-sm">
                  <div
                    class="markup-color-box"
                    :style="{ backgroundColor: markup.color, opacity: markup.opacity }"
                  />
                  <q-btn
                    flat
                    dense
                    size="sm"
                    icon="delete"
                    color="negative"
                    @click.stop="deleteMarkup(markup.id)"
                  />
                </div>
                <div v-if="markup.content" class="text-body2 text-grey-8">
                  {{ markup.content }}
                </div>
                <div class="text-caption text-grey">
                  {{ $t('markup.style') }}: {{ markup.style || 'highlight' }}
                </div>
              </div>
            </div>
            <div v-else class="text-center text-grey">
              {{ $t('markup.title') }} {{ $t('document.noDocuments') }}
            </div>

            <!-- 選択中のマークアップ編集 -->
            <div v-if="selectedMarkup" class="q-mt-lg pt-md border-top">
              <h6 class="q-my-md">{{ $t('button.edit') }}</h6>
              <q-input
                v-model="selectedMarkup.content"
                outlined
                :label="$t('markup.content')"
                type="textarea"
                rows="3"
                class="q-mb-md"
              />
              <div class="row gap-sm">
                <q-btn
                  unelevated
                  color="primary"
                  :label="$t('button.save')"
                  size="sm"
                  @click="saveMarkupEdit"
                />
                <q-btn flat :label="$t('button.cancel')" size="sm" @click="selectedMarkup = null" />
              </div>
            </div>
          </q-tab-panel>

          <!-- 改訂履歴タブ -->
          <q-tab-panel name="revisions" class="q-pa-md">
            <div v-if="revisions.length > 0" class="revision-list">
              <div
                v-for="revision in revisions"
                :key="revision.id"
                class="q-mb-md p-md bg-grey-2 rounded"
              >
                <div class="text-h6">v{{ revision.revisionNumber }}</div>
                <div class="text-body2">{{ formatDate(revision.changedAt) }}</div>
                <div v-if="revision.changeDescription" class="text-caption text-grey-8">
                  {{ revision.changeDescription }}
                </div>
              </div>
            </div>
            <div v-else class="text-center text-grey">
              {{ $t('revision.noRevisions') }}
            </div>
          </q-tab-panel>

          <!-- 情報タブ -->
          <q-tab-panel name="info" class="q-pa-md">
            <div class="info-list">
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.title') }}:</span>
                <span>{{ document.title }}</span>
              </div>
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.genre') }}:</span>
                <span>{{ document.genre }}</span>
              </div>
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.pages') }}:</span>
                <span>{{ document.pageCount }}</span>
              </div>
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.uploadedAt') }}:</span>
                <span>{{ formatDate(document.uploadedAt) }}</span>
              </div>
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.updatedAt') }}:</span>
                <span>{{ formatDate(document.updatedAt) }}</span>
              </div>
              <div class="q-mb-md">
                <span class="text-weight-bold">{{ $t('document.description') }}:</span>
                <p class="text-body2">{{ document.description }}</p>
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </template>
    </q-splitter>
  </q-page>

  <q-page v-else class="flex items-center justify-center">
    <q-spinner size="50px" color="primary" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useBackendApi } from 'src/apis/backendApi';
import type { DocumentMetadata, DocumentMarkup, DocumentRevision } from 'src/models/schemas';

const route = useRoute();
const { t: $t } = useI18n();
const $q = useQuasar();
const api = useBackendApi();

const document = ref<DocumentMetadata | null>(null);
const markups = ref<DocumentMarkup[]>([]);
const revisions = ref<DocumentRevision[]>([]);
const selectedMarkup = ref<DocumentMarkup | null>(null);
const pdfLoaded = ref(false);
const zoomLevel = ref(100);
const currentPage = ref(1);
const tabActive = ref('markups');
const splitterModel = ref(30);
const showRevisions = ref(false);

const documentId = computed(() => route.params.id as string);

const currentPageMarkups = computed(() => {
  return markups.value.filter((m) => m.pageNumber === currentPage.value);
});

onMounted(async () => {
  await loadDocument();
});

/**
 * ドキュメントを読み込み
 */
async function loadDocument() {
  const response = await api.getDocument(documentId.value);
  if (response.success && response.data) {
    document.value = response.data;
    await loadMarkups();
    await loadRevisions();
    // PDFラ렌더링（デモ用はスキップ）
    pdfLoaded.value = true;
  }
}

/**
 * マークアップを読み込み
 */
async function loadMarkups() {
  const response = await api.getMarkupsByDocument(documentId.value);
  if (response.success && response.data) {
    markups.value = response.data;
  }
}

/**
 * 改訂履歴を読み込み
 */
async function loadRevisions() {
  const response = await api.getDocumentRevisions(documentId.value);
  if (response.success && response.data) {
    revisions.value = response.data;
  }
}

/**
 * 新規マークアップを作成
 */
async function createNewMarkup() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'] as const;
  const randomColor = colors[Math.floor(Math.random() * colors.length)] ?? colors[0];

  const response = await api.createMarkup(
    documentId.value,
    currentPage.value,
    50,
    50,
    200,
    100,
    randomColor,
    'New Markup',
    'highlight' as const,
  );

  if (response.success && response.data) {
    markups.value.push(response.data);
    selectedMarkup.value = response.data;
  }
}

/**
 * マークアップを選択
 */
function selectMarkup(markup: DocumentMarkup) {
  selectedMarkup.value = markup;
}

/**
 * マークアップ編集を保存
 */
async function saveMarkupEdit() {
  if (selectedMarkup.value) {
    const response = await api.updateMarkup(selectedMarkup.value.id, {
      content: selectedMarkup.value.content,
    });

    if (response.success) {
      $q.notify({
        type: 'positive',
        message: $t('message.success'),
      });
      selectedMarkup.value = null;
    }
  }
}

/**
 * マークアップを削除
 */
async function deleteMarkup(id: string) {
  const response = await api.deleteMarkup(id);
  if (response.success) {
    markups.value = markups.value.filter((m) => m.id !== id);
    selectedMarkup.value = null;
    $q.notify({
      type: 'positive',
      message: $t('message.success'),
    });
  }
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
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped lang="scss">
.pdf-viewer {
  overflow: auto;
  height: 100%;
  background: #f5f5f5;
  position: relative;

  .pdf-container {
    position: relative;
    display: inline-block;
  }
}

.markup-color-box {
  width: 20px;
  height: 20px;
  border: 1px solid #ddd;
  border-radius: 2px;
}

.p-md {
  padding: 12px;
}

.pt-md {
  padding-top: 12px;
}

.gap-sm {
  gap: 8px;
}

.border-top {
  border-top: 1px solid #e0e0e0;
}
</style>

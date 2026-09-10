<template>
  <!-- コンテナ横断のテキスト検索パネル（VSCodeのサイドバー検索と同じ配置。issue由来の要望対応）。
       登録済みの全コンテナを対象に検索する。文書内のCtrl+F検索（SearchBar.vue）とは独立した状態を持つ -->
  <div class="search-view">
    <div class="search-view-header q-pa-sm">
      <div class="text-subtitle2">{{ $t('searchPanel.title') }}</div>
    </div>

    <div class="q-px-sm q-pb-xs">
      <q-input
        v-model="query"
        dense
        outlined
        clearable
        :placeholder="$t('searchPanel.placeholder')"
        @keydown.enter="runSearch"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
        <template #append>
          <q-spinner v-if="isSearching" size="18px" />
        </template>
      </q-input>
    </div>

    <!-- 検索オプション（大文字小文字・半角全角・正規表現）。文書内検索と同じ共通コンポーネント -->
    <div class="search-view-options q-px-sm q-pb-sm">
      <SearchOptionToggles :options="options" @update:options="onUpdateOptions" />
    </div>

    <q-separator />

    <div class="search-view-results">
      <div v-if="containers.length === 0" class="text-grey-6 text-caption q-pa-sm">
        {{ $t('searchPanel.noContainers') }}
      </div>
      <template v-else>
        <!-- 一部コンテナの検索が失敗した場合も、`onResult`経由で既に届いている部分的な結果は
             下の一覧にそのまま表示しつつ、不完全である旨をここで併記する -->
        <div v-if="searchFailed" class="text-negative text-caption q-pa-sm">
          {{ $t('searchPanel.searchFailed') }}
        </div>
        <div
          v-if="!searchFailed && hasSearched && !isSearching && results.length === 0"
          class="text-grey-6 text-caption q-pa-sm"
        >
          {{ $t('searchPanel.noResults') }}
        </div>
        <!-- ファイルごとにq-expansion-itemで畳み、既定では開いた状態で表示する -->
        <q-list v-if="results.length > 0" dense>
          <q-expansion-item
            v-for="result in results"
            :key="fileKey(result.file)"
            dense
            default-opened
            switch-toggle-side
            header-class="search-view-file-header"
            expand-icon-class="search-view-toggle-icon"
          >
            <template #header>
              <!-- ファイルパスの長さに関わらず常に1行で表示する。ファイル名を主として表示し、
                   その横の余白にコンテナ名・フルパスを小さく薄い文字で添え、収まらない分は
                   `...`で省略する -->
              <q-item-section class="search-view-file-header__name">
                <q-item-label lines="1">{{ fileNameOf(result.file.path) }}</q-item-label>
              </q-item-section>
              <q-item-section class="search-view-file-header__path">
                <q-item-label lines="1" class="search-view-file-header__path-text">
                  {{
                    $t('searchPanel.fileHeaderPath', {
                      containerName: containerNameOf(result.file.containerID),
                      path: result.file.path,
                    })
                  }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge outline color="primary">{{ result.matches.length }}</q-badge>
              </q-item-section>
            </template>

            <q-item
              v-for="(match, idx) in result.matches"
              :key="`${fileKey(result.file)}-${idx}`"
              clickable
              dense
              class="search-view-match-item"
              :title="$t('searchPanel.pageLabel', { page: match.pageNumber })"
              @click="openResult(result.file, match.pageNumber)"
            >
              <q-item-section>
                <!-- ヒット文字とその前後（同一行のみ）をハイライト表示する。ファイル単位検索の
                     PDF上ハイライトと同じ配色（$search-highlight）を使い、表示の一貫性を保つ -->
                <q-item-label class="search-view-snippet"
                  ><span class="search-view-snippet__context">{{ match.contextBefore }}</span
                  ><mark class="search-view-snippet__hit">{{ match.text }}</mark
                  ><span class="search-view-snippet__context">{{
                    match.contextAfter
                  }}</span></q-item-label
                >
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>{{ match.pageNumber }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-expansion-item>
        </q-list>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useBackendApi } from 'src/apis/backendApi';
import { useEditorStore } from 'src/stores/editorStore';
import { fileKey } from 'src/utils/document/fileKey';
import { Path } from 'src/utils/binary/path';
import { createGenerationGuard } from 'src/utils/promise/generationGuard';
import SearchOptionToggles from 'src/components/Search/SearchOptionToggles.vue';
import type { ContainerElementFile, ContainerID, ContainerSkel } from 'src/models/container';
import type { ContainerTextSearchResult, TextSearchOptions } from 'src/models/document/search';

const api = useBackendApi();
const editorStore = useEditorStore();

const query = ref('');
const options = ref<TextSearchOptions>({
  caseSensitive: false,
  distinguishWidth: false,
  useRegex: false,
});
const results = ref<ContainerTextSearchResult[]>([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const searchFailed = ref(false);
const containers = ref<ContainerSkel[]>([]);

/** 実行中の検索を識別する世代ガード。重複実行時に古い検索の結果・ローディング状態が
 * 新しい検索を上書きしないよう、各`runSearch`呼び出しの中身は自分の世代が現在も最新かを
 * 確認してから状態を更新する（コンテナツリーの段階的読み込みと同じ考え方。
 * `src/utils/promise/generationGuard.ts`参照） */
const searchGuard = createGenerationGuard();

/** SearchOptionTogglesからのオプション変更を反映し、現在のqueryで即座に再検索する */
function onUpdateOptions(v: TextSearchOptions): void {
  options.value = v;
  void runSearch();
}

/** キーストロークのたびの自動検索は行わない（全コンテナ×全文書の走査は重いため、Enter/オプション変更でのみ実行する） */
async function runSearch(): Promise<void> {
  const trimmed = query.value.trim();
  const generation = searchGuard.start();

  if (trimmed === '') {
    results.value = [];
    hasSearched.value = false;
    searchFailed.value = false;
    isSearching.value = false;
    return;
  }

  // 検索開始前にコンテナ一覧を取り直す。パネルを開いた後に作成・削除されたコンテナも
  // 検索対象・空状態表示の双方に正しく反映するため
  const containersRes = await api.getAllContainers();
  if (!searchGuard.isCurrent(generation)) return;
  if (containersRes.ok) containers.value = containersRes.data;

  isSearching.value = true;
  hasSearched.value = true;
  searchFailed.value = false;
  results.value = [];
  try {
    const res = await api.searchAllContainersText(trimmed, { ...options.value }, (result) => {
      if (searchGuard.isCurrent(generation)) results.value.push(result);
    });
    if (searchGuard.isCurrent(generation)) searchFailed.value = !res.ok;
  } finally {
    if (searchGuard.isCurrent(generation)) isSearching.value = false;
  }
}

function containerNameOf(cId: ContainerID): string {
  return containers.value.find((c) => c.id === cId)?.name ?? cId;
}

/** ヘッダーに主として表示するファイル名（パスの末尾要素） */
function fileNameOf(path: string): string {
  return new Path(path).basename();
}

/**
 * 検索結果をクリックした際、該当文書の該当ページをタブで開く
 *
 * 現在の検索クエリも一緒に渡し、開いたタブ側で文書内検索（Ctrl+F相当）を自動実行させることで、
 * コンテナ横断検索の結果クリックでもヒット箇所がPDF上にハイライト表示されるようにする
 */
function openResult(file: ContainerElementFile, pageNumber: number): void {
  editorStore.openTab(file, pageNumber, undefined, query.value.trim());
}

onMounted(async () => {
  const res = await api.getAllContainers();
  if (res.ok) containers.value = res.data;
});
</script>

<style lang="scss" scoped>
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.search-view-header {
  display: flex;
  align-items: center;
}

.search-view-results {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}

// 既定のq-item左パディング（16px）から1文字分程度（約12px）を切り詰め、その分の余白に
// switch-toggle-sideで左側へ移した展開矢印（.search-view-toggle-icon）を収める。折り畳み内の
// 各結果アイテム（.search-view-match-item）も同じ左パディングへ揃え、見た目のインデントを一致させる。
// `header-class`/`expand-icon-class`で指定した要素はq-expansion-item自身が内部で描画する
// （このコンポーネントの`<template>`が直接生成する要素ではない）ため、scoped CSSの通常のセレクタ
// では届かず`:deep()`を使う必要がある
:deep(.search-view-file-header) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  padding-left: 4px;
  font-weight: 500;
}

:deep(.search-view-toggle-icon) {
  min-width: 20px;
  padding-right: 0;

  .q-icon {
    font-size: 18px;
  }
}

// ファイル名を主として優先表示するため、フルパス側は`flex-basis: 0`にして「自身の内容量に応じた
// 分配」ではなく「ファイル名が使った残りの余白のみ」を使うようにする。ファイル名が短い場合は
// フルパス側がその分多く広がり、ファイル名が長い場合はファイル名自身が省略記号で収まる
.search-view-file-header__name {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 70%;
  padding: 0;
}

.search-view-file-header__path {
  flex: 1 1 0%;
  min-width: 0;
  padding: 0;
  margin-left: 6px;
}

.search-view-file-header__path-text {
  color: $grey-7;
  font-size: 11px;
}

.body--dark .search-view-file-header__path-text {
  color: $grey-5;
}

.search-view-match-item {
  padding-left: 4px;
}

.search-view-snippet {
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-view-snippet__context {
  color: $grey-7;
}

.body--dark .search-view-snippet__context {
  color: $grey-5;
}

.search-view-snippet__hit {
  background: $search-highlight;
  color: inherit;
  border-radius: 2px;
  font-weight: 700;
}
</style>

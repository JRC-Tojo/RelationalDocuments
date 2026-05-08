<template>
  <q-page>
    <!-- メインツールバー -->
    <q-bar class="main-toolbar bg-primary text-white">
      <template v-for="tool in docpageStore.mainTools" :key="tool.id">
        <!-- トグルツール -->
        <template v-if="tool.action === 'toggle'">
          <q-btn
            flat
            dense
            round
            :icon="tool.icon"
            :title="tool.tooltip"
            class="toolbar-btn"
            @click="handleToolClick(tool)"
          />
        </template>

        <!-- メニュー付きツール -->
        <template v-else-if="tool.action === 'menu' && tool.subTools">
          <q-btn-dropdown
            flat
            dense
            round
            :icon="tool.icon"
            :title="tool.tooltip"
            class="toolbar-btn"
          >
            <q-list>
              <q-item
                v-for="subTool in tool.subTools"
                :key="subTool.id"
                clickable
                @click="handleSubToolClick(subTool.id)"
              >
                <q-item-section avatar>
                  <q-icon :name="subTool.icon" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ subTool.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </template>

        <!-- ダイレクト実行ツール -->
        <template v-else-if="tool.action === 'direct'">
          <q-btn
            flat
            dense
            round
            :icon="tool.icon"
            :title="tool.tooltip"
            class="toolbar-btn"
            @click="handleToolClick(tool)"
          />
        </template>
      </template>
    </q-bar>

    <!-- サブツールバー -->
    <q-bar v-if="docpageStore.subTools.length > 0" class="sub-toolbar bg-grey-2">
      <template v-for="tool in docpageStore.subTools" :key="tool.id">
        <q-btn
          flat
          dense
          round
          :icon="tool.icon"
          :title="tool.tooltip"
          :label="tool.label"
          class="toolbar-btn-sub"
          @click="handleSubToolClick(tool.id)"
        />
      </template>
    </q-bar>

    <!-- ドキュメントレイアウト -->
    <div class="grid">
      <!-- <doc-tabs-page
        v-for="side in Object.keys(docpageStore.tabs) as LayoutSide[]"
        :key="side"
        v-model="docpageStore.tabs[side]"
      /> -->
      <doc-tabs-page v-model="docpageStore.tabs.ul" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onBeforeMount } from 'vue';
import { useEditorStore } from 'src/stores/editorStore';
// import type { LayoutSide } from 'src/stores/editorStore';
import { localStorageRepository } from 'src/repositories/localStorageRepository';
import DocTabsPage from './DocTabsPage.vue';
import type { IDocTool } from 'src/models/docPage';

/**
 * 文書ページコンポーネント
 * ツールバーとドキュメントレイアウトを統合
 */

const docpageStore = useEditorStore();

/**
 * メインツールをクリック
 */
const handleToolClick = (tool: IDocTool) => {
  tool.onClicked?.();
  docpageStore.handleAnnotationToolClick(tool.id);

  // ツール固有の処理
  switch (tool.id) {
    case 'print':
      handlePrint();
      break;
    case 'download':
      handleDownload();
      break;
    case 'save-overwrite':
      handleSaveOverwrite();
      break;
    case 'save-as':
      handleSaveAs();
      break;
  }
};

/**
 * サブツールをクリック
 */
const handleSubToolClick = (toolId: string) => {
  // TODO: サブツール固有の処理を実装
  console.log('Sub tool clicked:', toolId);
};

/**
 * 印刷処理
 */
const handlePrint = () => {
  window.print();
};

/**
 * ダウンロード処理
 */
const handleDownload = () => {
  // TODO: ドキュメントをダウンロード
  console.log('Download document');
};

/**
 * 上書き保存処理
 */
const handleSaveOverwrite = () => {
  // TODO: ドキュメントを上書き保存
  console.log('Save document (overwrite)');
};

/**
 * 名前を付けて保存処理
 */
const handleSaveAs = () => {
  // TODO: ドキュメントを名前を付けて保存
  console.log('Save document (as)');
};

/**
 * サンプルドキュメントを初期化
 */
onBeforeMount(async () => {
  // TODO: サンプルドキュメントをローカルストレージから取得
  // 今後、Explorerのクリックから取得するように修正
  try {
    const documents = await localStorageRepository.getAllDocuments();
    if (documents && documents.length > 0 && documents[0]) {
      // 最初のドキュメントを開く
      docpageStore.openTab(documents[0].id, documents[0].title);
    }
  } catch (error) {
    console.error('Failed to load documents:', error);
  }
});
</script>

<style scoped lang="scss">
.main-toolbar {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem;
  flex-wrap: wrap;

  .toolbar-btn {
    &:hover {
      background-color: rgba(white, 0.2);
    }
  }
}

.sub-toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid $grey-4;
  flex-wrap: wrap;

  .toolbar-btn-sub {
    font-size: 0.85rem;

    &:hover {
      background-color: rgba($primary, 0.1);
    }
  }
}
</style>

<template>
  <q-page>
    <!-- メインツールバー -->
    <q-bar class="main-toolbar bg-primary text-white">
      <q-btn
        v-for="tool in editorStore.mainTools"
        :key="tool.id"
        flat
        dense
        :icon="tool.icon"
        :title="tool.label"
        class="toolbar-btn"
        @click="tool.onClicked()"
      />
    </q-bar>

    <!-- サブツールバー -->
    <q-bar v-if="editorStore.subTools.length > 0" class="sub-toolbar bg-grey-2">
      <template v-for="tool in editorStore.subTools" :key="tool.id">
        <q-btn
          flat
          dense
          :icon="tool.icon"
          :title="tool.label"
          :label="tool.label"
          class="toolbar-btn-sub"
          @click="tool.onClicked()"
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
      <doc-tabs-page v-model="editorStore.tabs.ul" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useEditorStore } from 'src/stores/editorStore';
import DocTabsPage from './DocTabsPage.vue';

/**
 * 文書ページコンポーネント
 * ツールバーとドキュメントレイアウトを統合
 */

const editorStore = useEditorStore();
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

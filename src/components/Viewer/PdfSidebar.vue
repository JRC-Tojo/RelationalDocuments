<template>
  <div class="pdf-sidebar">
    <!-- タブナビゲーション -->
    <q-tabs
      v-model="activeTab"
      vertical
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="thumbnails" icon="image" :label="$t('pdfEditor.thumbnails')" />
      <q-tab name="bookmarks" icon="bookmark" :label="$t('pdfEditor.bookmarks')" />
    </q-tabs>

    <!-- タブパネル -->
    <q-tab-panels v-model="activeTab" animated class="sidebar-content">
      <!-- サムネイル一覧 -->
      <q-tab-panel name="thumbnails" class="q-pa-md">
        <div class="thumbnails-grid">
          <div
            v-for="(thumb, index) in thumbnails"
            :key="index"
            class="thumbnail-item"
            :class="{ active: currentPage === index + 1 }"
            @click="$emit('page-change', index + 1)"
          >
            <img :src="thumb" :alt="`Page ${index + 1}`" class="thumbnail-image" />
            <div class="page-label">{{ index + 1 }}</div>
          </div>
        </div>
      </q-tab-panel>

      <!-- ブックマーク一覧 -->
      <q-tab-panel name="bookmarks" class="q-pa-md">
        <div class="bookmarks-list">
          <div
            v-for="(bookmark, index) in bookmarks"
            :key="index"
            class="bookmark-item"
            @click="$emit('page-change', bookmark.pageNumber)"
          >
            <q-icon name="bookmark" class="q-mr-sm" />
            <div class="bookmark-content">
              <div class="text-subtitle2">{{ bookmark.title }}</div>
              <div class="text-caption text-grey">
                {{ $t('pdfEditor.page') }} {{ bookmark.pageNumber }}
              </div>
            </div>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="close"
              @click.stop="$emit('delete-bookmark', index)"
            />
          </div>

          <div v-if="bookmarks.length === 0" class="text-center text-grey q-mt-md">
            {{ $t('pdfEditor.noBookmarks') }}
          </div>

          <q-btn
            flat
            class="full-width q-mt-md"
            icon="add"
            :label="$t('pdfEditor.addBookmark')"
            size="sm"
            @click="$emit('add-bookmark')"
          />
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface Bookmark {
  pageNumber: number;
  title: string;
}

interface Props {
  currentPage: number;
  thumbnails: string[];
  bookmarks: Bookmark[];
}

interface Emits {
  (e: 'page-change', page: number): void;
  (e: 'add-bookmark'): void;
  (e: 'delete-bookmark', index: number): void;
}

defineProps<Props>();
defineEmits<Emits>();

const { t: $t } = useI18n();
const activeTab = ref('thumbnails');
</script>

<style scoped lang="scss">
.pdf-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.thumbnails-grid {
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
  aspect-ratio: 4 / 5;

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .page-label {
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.6);
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
  padding: 8px 4px;
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
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>

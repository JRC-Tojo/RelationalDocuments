<template>
  <q-drawer v-model="drawerOpen" side="left" bordered class="document-left-drawer">
    <!-- サムネイル一覧 -->
    <q-separator />
    <div class="drawer-section q-pa-md">
      <h6 class="q-my-none q-mb-md">{{ $t('pagesThumbnails') }}</h6>
      <div class="thumbnails-list">
        <div
          v-for="page in totalPageCount"
          :key="page"
          :class="['thumbnail-item', { active: page === currentPage }]"
          @click="onGoToPage(page)"
        >
          <img
            v-if="totalPageCount === thumnails.length"
            :src="thumnails[page - 1]"
            :alt="`Page ${page}`"
          />
          <q-spinner v-else color="primary" class="fit q-pa-md" />
          <div class="page-number">{{ page }}</div>
        </div>
      </div>
    </div>

    <!-- ブックマーク -->
    <q-separator />
    <div class="drawer-section q-pa-md">
      <h6 class="q-my-none q-mb-md">{{ $t('bookmarks') }}</h6>
      <div v-if="bookmarks.length === 0" class="q-pa-md text-center text-grey">
        {{ $t('noBookmarks') }}
      </div>
      <q-list v-else>
        <q-item
          v-for="bookmark in bookmarks"
          :key="bookmark.id"
          clickable
          @click="onGoToPage(bookmark.pageNumber)"
        >
          <q-item-section avatar>
            <q-icon name="bookmark" color="amber" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ bookmark.label }}</q-item-label>
            <q-item-label caption>{{ $t('page') }} {{ bookmark.pageNumber }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Prop {
  totalPageCount: number;
  currentPage: number;
  thumnails: string[];
  onGoToPage: (page: number) => void;
}
defineProps<Prop>();

const drawerOpen = defineModel<boolean>('drawerOpen', { required: true });

interface Bookmark {
  id: string;
  pageNumber: number;
  label: string;
}

// TODO: ブックマークはバックエンドから取得する
const bookmarks = computed<Bookmark[]>(() => []);
</script>

<style scoped lang="scss">
.document-left-drawer {
  .drawer-section {
    h6 {
      font-weight: 600;
      font-size: 0.95rem;
      color: $primary;
    }
  }

  .document-info {
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;

      .label {
        font-weight: 500;
        color: $grey-8;
      }

      .value {
        color: $grey-7;
        word-break: break-word;
        max-width: 60%;
        text-align: left;
      }
    }
  }

  .thumbnails-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 50%));
    gap: 0.5rem;

    .thumbnail-item {
      cursor: pointer;
      border: 2px solid $grey-3;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        border-color: $primary;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      &.active {
        border-color: $primary;
        background-color: lighten($primary, 45%);
      }

      .page-number {
        padding: 0.25rem;
        text-align: center;
        font-size: 0.75rem;
        background-color: $grey-2;
        color: $grey-7;
      }
    }
  }
}
</style>

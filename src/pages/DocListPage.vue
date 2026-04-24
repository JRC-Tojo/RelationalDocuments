<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-lg">
      <h1 class="text-h4 q-my-none">{{ $t('title.documents') }}</h1>
      <div class="row gap-md">
        <q-input
          v-model="searchQuery"
          outlined
          dense
          :placeholder="$t('search.placeholder')"
          class="col-auto"
          style="width: 250px"
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
        <q-btn
          color="primary"
          icon="add"
          :label="$t('button.add')"
          @click="showCreateDialog = true"
        />
        <q-btn color="primary" flat icon="refresh" @click="refreshDocuments" />
      </div>
    </div>

    <div class="row gap-md q-mb-lg">
      <q-select
        v-model="viewMode"
        :options="viewModes"
        outlined
        dense
        emit-value
        map-options
        class="col-auto"
        style="width: 150px"
      />
      <q-select
        v-model="sortBy"
        :options="sortOptions"
        outlined
        dense
        emit-value
        map-options
        class="col-auto"
        style="width: 150px"
      />
    </div>

    <!-- ドキュメント一覧 -->
    <div v-if="filteredDocuments.length > 0">
      <!-- リッチ表示 -->
      <div v-if="viewMode === 'rich'" class="row q-col-gutter-md">
        <div v-for="doc in filteredDocuments" :key="doc.id" class="col-xs-12 col-sm-6 col-md-4">
          <q-card clickable @click="goToDocument(doc.id)">
            <q-card-section>
              <div class="text-h6">{{ doc.title }}</div>
              <div class="text-caption text-grey">{{ doc.genre }}</div>
            </q-card-section>
            <q-card-section class="text-body2">
              {{ doc.description }}
            </q-card-section>
            <q-card-section class="row justify-between text-caption">
              <span>{{ doc.pageCount }} {{ $t('document.pages') }}</span>
              <span>{{ formatDate(doc.updatedAt) }}</span>
            </q-card-section>
            <q-card-actions>
              <q-btn flat dense color="primary" icon="edit" @click.stop="editDocument(doc)" />
              <q-btn
                flat
                dense
                color="negative"
                icon="delete"
                @click.stop="deleteDocument(doc.id)"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>

      <!-- リスト表示（広） -->
      <div v-else-if="viewMode === 'list1'">
        <div v-for="doc in filteredDocuments" :key="doc.id" class="q-mb-md">
          <q-item clickable @click="goToDocument(doc.id)" class="bg-grey-2 rounded">
            <q-item-section avatar>
              <q-icon name="description" size="lg" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-h6">{{ doc.title }}</q-item-label>
              <q-item-label caption>{{ doc.description }}</q-item-label>
              <q-item-label caption class="text-grey">
                {{ doc.genre }} • {{ doc.pageCount }} {{ $t('document.pages') }} •
                {{ formatDate(doc.updatedAt) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-btn-group flat>
                <q-btn flat dense color="primary" icon="edit" @click.stop="editDocument(doc)" />
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="delete"
                  @click.stop="deleteDocument(doc.id)"
                />
              </q-btn-group>
            </q-item-section>
          </q-item>
        </div>
      </div>

      <!-- リスト表示（狭） -->
      <div v-else class="q-mb-md">
        <q-table
          :rows="filteredDocuments"
          :columns="tableColumns"
          row-key="id"
          flat
          bordered
          @row-click="(evt: any) => goToDocument(evt.data.id)"
        >
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                dense
                size="sm"
                color="primary"
                icon="edit"
                @click.stop="editDocument(props.row)"
              />
              <q-btn
                flat
                dense
                size="sm"
                color="negative"
                icon="delete"
                @click.stop="deleteDocument(props.row.id)"
              />
            </q-td>
          </template>
        </q-table>
      </div>
    </div>

    <!-- ドキュメントなし -->
    <div v-else class="text-center q-my-lg">
      <q-icon name="description" size="64px" color="grey-5" />
      <p class="text-grey">{{ $t('document.noDocuments') }}</p>
    </div>

    <!-- 新規作成/編集ダイアログ -->
    <q-dialog v-model="showCreateDialog">
      <q-card style="width: 500px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editingDoc ? $t('button.edit') : $t('document.createNew') }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-input v-model="formData.title" outlined :label="$t('document.name')" class="q-mb-md" />
          <q-input
            v-model="formData.genre"
            outlined
            :label="$t('document.genre')"
            class="q-mb-md"
          />
          <q-input
            v-model="formData.description"
            outlined
            :label="$t('document.description')"
            type="textarea"
            rows="3"
            class="q-mb-md"
          />
          <q-input
            v-model.number="formData.pageCount"
            outlined
            :label="$t('document.pages')"
            type="number"
            class="q-mb-md"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('button.cancel')" v-close-popup />
          <q-btn unelevated color="primary" :label="$t('button.save')" @click="saveDocument" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useBackendApi } from 'src/apis/backendApi';
import type { DocumentMetadata } from 'src/models/schemas';

const router = useRouter();
const { t: $t } = useI18n();
const $q = useQuasar();
const api = useBackendApi();

const documents = ref<DocumentMetadata[]>([]);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const editingDoc = ref<DocumentMetadata | null>(null);
const viewMode = ref<'rich' | 'list1' | 'list2'>('rich');
const sortBy = ref<'name' | 'updatedAt' | 'genre'>('updatedAt');

const viewModes = [
  { label: $t('viewMode.rich'), value: 'rich' },
  { label: $t('viewMode.list1'), value: 'list1' },
  { label: $t('viewMode.list2'), value: 'list2' },
];

const sortOptions = [
  { label: $t('sort.byName'), value: 'name' },
  { label: $t('sort.byUpdatedAt'), value: 'updatedAt' },
  { label: $t('sort.byGenre'), value: 'genre' },
];

const tableColumns = [
  { name: 'title', label: $t('document.name'), field: 'title', align: 'left' as const },
  { name: 'genre', label: $t('document.genre'), field: 'genre', align: 'left' as const },
  { name: 'pageCount', label: $t('document.pages'), field: 'pageCount', align: 'center' as const },
  {
    name: 'updatedAt',
    label: $t('document.updatedAt'),
    field: 'updatedAt',
    align: 'left' as const,
  },
  { name: 'actions', label: '', field: '', align: 'center' as const },
];

const formData = ref({
  title: '',
  genre: '',
  description: '',
  pageCount: 1,
});

const filteredDocuments = computed(() => {
  const filtered = documents.value.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );

  // ソート処理
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.title.localeCompare(b.title);
      case 'genre':
        return (a.genre || '').localeCompare(b.genre || '');
      case 'updatedAt':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  return filtered;
});

/**
 * 初期化
 */
onMounted(async () => {
  await api.initialize();
  await refreshDocuments();
});

/**
 * ドキュメント一覧を更新
 */
async function refreshDocuments() {
  const response = await api.getAllDocuments();
  if (response.success) {
    documents.value = response.data || [];
  }
}

/**
 * ドキュメント詳細ページに遷移
 */
function goToDocument(id: string) {
  void router.push(`/document/${id}`);
}

/**
 * ドキュメント編集ダイアログを開く
 */
function editDocument(doc: DocumentMetadata) {
  editingDoc.value = doc;
  formData.value = {
    title: doc.title,
    genre: doc.genre || '',
    description: doc.description || '',
    pageCount: doc.pageCount,
  };
  showCreateDialog.value = true;
}

/**
 * ドキュメントを保存
 */
async function saveDocument() {
  if (!formData.value.title) {
    $q.notify({
      type: 'negative',
      message: $t('error.documentNotFound'),
    });
    return;
  }

  if (editingDoc.value) {
    // 更新
    const response = await api.updateDocument(editingDoc.value.id, {
      title: formData.value.title,
      genre: formData.value.genre,
      description: formData.value.description,
      pageCount: formData.value.pageCount,
    });

    if (response.success) {
      $q.notify({
        type: 'positive',
        message: $t('message.success'),
      });
      showCreateDialog.value = false;
      editingDoc.value = null;
      await refreshDocuments();
    }
  } else {
    // 新規作成
    const response = await api.createDocument(
      formData.value.title,
      '',
      formData.value.title,
      formData.value.pageCount,
      0,
      formData.value.description,
      formData.value.genre,
    );

    if (response.success) {
      $q.notify({
        type: 'positive',
        message: $t('message.success'),
      });
      showCreateDialog.value = false;
      formData.value = { title: '', genre: '', description: '', pageCount: 1 };
      await refreshDocuments();
    }
  }
}

/**
 * ドキュメントを削除
 */
function deleteDocument(id: string) {
  console.log('Delete doc id: ', id);
  $q.dialog({
    title: $t('button.delete'),
    message: $t('document.deleteConfirm'),
    cancel: true,
    persistent: true,
  });
  // .onOk(() => {
  //   const response = await api.deleteDocument(id);
  //   if (response.success) {
  //     $q.notify({
  //       type: 'positive',
  //       message: $t('message.success'),
  //     });
  //     refreshDocuments();
  //   }
  // });
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
</script>

<style scoped lang="scss">
.gap-md {
  gap: 12px;
}
</style>

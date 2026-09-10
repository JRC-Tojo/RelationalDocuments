import { describe, expect, it, beforeEach } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { ContainerElementFile, ContainerID } from 'src/models/container';

/**
 * `editorStore.openTab`/`openTabAt`の`searchQuery`引数（コンテナ横断検索からの
 * ハイライト自動表示のために追加した経路）が、`pendingTabFocus`へ正しく伝搬されるかの検証。
 *
 * `editorStore.ts`自体はbackendApi等の重い依存を静的importしていないため、
 * relationalStore.test.tsのようなモジュールモックは不要で、そのままimportして使える
 */
const { useEditorStore } = await import('../editorStore');

const containerID = '00000000-0000-4000-8000-000000000001' as ContainerID;

function buildFile(path: string): ContainerElementFile {
  return {
    containerID,
    type: 'File',
    path,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: '',
    genre: '',
    tags: [],
  };
}

describe('editorStore.openTab / openTabAt: pendingTabFocusへのsearchQuery伝搬', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('searchQueryを指定してopenTabすると、pendingTabFocusにそのままクエリが載る', () => {
    const store = useEditorStore();
    const file = buildFile('計算書.pdf');

    store.openTab(file, 3, undefined, 'SM400');

    expect(store.pendingTabFocus).toEqual({
      containerID,
      path: '計算書.pdf',
      page: 3,
      annotId: undefined,
      searchQuery: 'SM400',
    });
  });

  it('searchQueryを指定しない従来通りの呼び出しでは、pendingTabFocus.searchQueryはundefinedのままになる', () => {
    const store = useEditorStore();
    const file = buildFile('一般図.pdf');

    store.openTab(file, 1);

    expect(store.pendingTabFocus?.searchQuery).toBeUndefined();
  });

  it('openTabAtでも、指定したペインのタブに対して同様にsearchQueryが伝搬する', () => {
    const store = useEditorStore();
    const file = buildFile('計算書.pdf');

    store.openTabAt(file, 'ur', 2, undefined, '148.8');

    expect(store.tabs.ur).toContainEqual(file);
    expect(store.pendingTabFocus?.searchQuery).toBe('148.8');
  });
});

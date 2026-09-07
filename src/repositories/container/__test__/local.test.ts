/**
 * local.ts の単体テスト（`loadContainerElements`のツリー走査まわり）
 *
 * File System Access APIの`FileSystemDirectoryHandle`はテスト環境に存在しないため、
 * 同じインターフェース（`entries()`・`getFile()`）だけを持つ疑似ハンドルを組み立てて検証する。
 * 永続化層である`fsHandleDB`は`mock.module`で差し替え、実際のIndexedDBには触れない
 * （`pdfDocumentCache.test.ts`と同じ、DOM依存モジュールを差し替えるための`await import`方針）
 */
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ContainerElement, ContainerID, ContainerSkel } from 'src/models/container';
import { Success } from 'src/models/error/result';

const containerID = '00000000-0000-4000-8000-000000000000' as ContainerID;

function buildSkel(): ContainerSkel {
  return { id: containerID, name: 'test', type: 'local', containerPath: '/test' };
}

/** テスト用の疑似ファイルツリー定義 */
interface FakeFile {
  kind: 'file';
  name: string;
  size?: number;
  delayMs?: number;
}
interface FakeDir {
  kind: 'dir';
  name: string;
  children: FakeEntry[];
}
type FakeEntry = FakeFile | FakeDir;

/**
 * テスト用の疑似`FileSystemDirectoryHandle`を組み立てる
 *
 * `getFile()`呼び出し中の同時実行数を`state`で追跡できるようにする（同時実行数上限の検証用）
 */
function buildFakeRoot(
  children: FakeEntry[],
  state: { current: number; max: number },
): FileSystemDirectoryHandle {
  const build = (entries: FakeEntry[]): FileSystemDirectoryHandle =>
    ({
      kind: 'directory',
      async *entries() {
        // 実際のFile System Access APIと同様、列挙自体も非同期であることを疑似的に再現する
        await Promise.resolve();
        for (const entry of entries) {
          if (entry.kind === 'dir') {
            yield [entry.name, build(entry.children)] as const;
          } else {
            const fileEntry = entry;
            const fileHandle = {
              kind: 'file',
              async getFile() {
                state.current++;
                state.max = Math.max(state.max, state.current);
                if (fileEntry.delayMs) {
                  await new Promise((resolve) => setTimeout(resolve, fileEntry.delayMs));
                }
                state.current--;
                return { size: fileEntry.size ?? 0, lastModified: 0 } as File;
              },
            } as unknown as FileSystemFileHandle;
            yield [entry.name, fileHandle] as const;
          }
        }
      },
    }) as unknown as FileSystemDirectoryHandle;
  return build(children);
}

let currentRootHandle: FileSystemDirectoryHandle | undefined;
void mock.module('src/repositories/inMemory/fsHandleDB', () => ({
  getHandle: async () => {
    await Promise.resolve();
    return Success({ skel: buildSkel(), handle: currentRootHandle });
  },
}));

const { loadContainerElements } = await import('../local');

describe('loadContainerElements', () => {
  beforeEach(() => {
    currentRootHandle = undefined;
  });

  it('複数のサブディレクトリに分散したファイルでも、getFile()の同時実行数がディレクトリ単位ではなく全体で上限までに絞られる', async () => {
    const state = { current: 0, max: 0 };
    // 各ディレクトリの中では上限(8)以下だが、4ディレクトリ合計では20件になる構成。
    // ディレクトリ単位にしか上限が効いていなければ全件同時実行され、maxは20近くまで達してしまう
    const makeDir = (name: string): FakeDir => ({
      kind: 'dir',
      name,
      children: Array.from({ length: 5 }, (_, i) => ({
        kind: 'file' as const,
        name: `f${i}.pdf`,
        delayMs: 10,
      })),
    });
    currentRootHandle = buildFakeRoot(
      [makeDir('a'), makeDir('b'), makeDir('c'), makeDir('d')],
      state,
    );

    const res = await loadContainerElements(buildSkel());

    expect(res.ok).toBe(true);
    expect(state.max).toBeLessThanOrEqual(8);
    // 直列実行(=1)ではなく、実際に複数ディレクトリをまたいで並列化されていること
    expect(state.max).toBeGreaterThan(1);
  });

  it('onElementで要素発見のたび随時通知し、フォルダは配下のファイル群より先に通知される', async () => {
    const state = { current: 0, max: 0 };
    currentRootHandle = buildFakeRoot(
      [
        {
          kind: 'dir',
          name: 'folder1',
          children: [
            { kind: 'file', name: 'a.pdf', delayMs: 5 },
            { kind: 'file', name: 'b.pdf', delayMs: 1 },
          ],
        },
        { kind: 'file', name: 'root.pdf', delayMs: 1 },
      ],
      state,
    );

    const notified: ContainerElement[] = [];
    const res = await loadContainerElements(buildSkel(), (element) => notified.push(element));

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 最終結果に含まれる全要素が、通知経由でも過不足なく届いていること
    const finalPaths = Object.keys(res.value.elements).sort();
    expect(notified.map((e) => e.path).sort()).toEqual(finalPaths);

    // フォルダは配下のファイルの`getFile()`完了を待たず、発見した時点で先に通知される
    const folderIndex = notified.findIndex((e) => e.path === 'folder1');
    const childAIndex = notified.findIndex((e) => e.path === 'folder1/a.pdf');
    const childBIndex = notified.findIndex((e) => e.path === 'folder1/b.pdf');
    expect(folderIndex).toBeGreaterThanOrEqual(0);
    expect(folderIndex).toBeLessThan(childAIndex);
    expect(folderIndex).toBeLessThan(childBIndex);
  });
});

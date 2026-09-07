import { describe, expect, it, mock } from 'bun:test';
import type { Container, ContainerElementFile, ContainerID } from 'src/models/container';
import { NotFoundError, Success } from 'src/models/error/result';

/**
 * `local.ts`の`deleteFile`が、File System Access APIが実際に投げるDOMException
 * （削除対象不存在時の`NotFoundError`）を、アプリ独自の`NotFoundError`へ正しく変換することを
 * 検証する回帰テスト（Issue #93対応中のレビューで発見：`deleteFile`が`toFsError`ではなく
 * 汎用の`toError`を使っていたため、呼び出し側の`instanceof NotFoundError`判定が機能せず、
 * 旧形式サイドカーを一度も持ったことのない文書を保存するたびに不要な警告ログが出続けていた）。
 *
 * `getDirectoryHandleByPath`・`loadSrcData`等ではなく、あえて`toError`のままだった
 * `deleteFile`自身の実装（`removeEntry`呼び出しのtry/catch）を、実際に経由する形で確認する。
 * `FileSystemDirectoryHandle`は実ブラウザAPIのため、最小限のフェイク実装に差し替える
 */
const containerID = '00000000-0000-4000-8000-000000000000' as ContainerID;

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

function buildContainer(): Container {
  return {
    id: containerID,
    name: 'container',
    type: 'local',
    containerPath: '/root',
    elements: {},
  };
}

// テストごとに差し替える擬似ルートディレクトリハンドル
let fakeRootHandle: FileSystemDirectoryHandle | undefined;

void mock.module('src/repositories/inMemory/fsHandleDB', () => ({
  getHandle: () => {
    if (fakeRootHandle === undefined) throw new Error('fakeRootHandle is not set');
    return Promise.resolve(
      Success({
        skel: { id: containerID, name: 'container', type: 'local' as const, containerPath: '/root' },
        handle: fakeRootHandle,
      }),
    );
  },
}));

const { deleteFile } = await import('../local');

/**
 * `removeEntry`が、対象が存在しない場合に実ブラウザ同様のDOMException（name: 'NotFoundError'）を
 * 投げる最小限のフェイク`FileSystemDirectoryHandle`を作る
 */
function createFakeRootHandle(existingFileNames: Set<string>): FileSystemDirectoryHandle {
  return {
    removeEntry: (name: string): Promise<void> => {
      if (!existingFileNames.has(name)) {
        return Promise.reject(
          new DOMException('A requested file or directory could not be found.', 'NotFoundError'),
        );
      }
      existingFileNames.delete(name);
      return Promise.resolve();
    },
  } as unknown as FileSystemDirectoryHandle;
}

describe('local.deleteFile（実際のDOMException NotFoundErrorをアプリのNotFoundErrorへ変換する）', () => {
  it('削除対象が実際に存在しない場合、DOMException NotFoundErrorをアプリのNotFoundErrorへ変換して返す', async () => {
    fakeRootHandle = createFakeRootHandle(new Set());

    const res = await deleteFile(buildContainer(), buildFile('missing.pdf.kcfg'));
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBeInstanceOf(NotFoundError);
  });

  it('削除対象が実際に存在する場合は正常に削除できる', async () => {
    fakeRootHandle = createFakeRootHandle(new Set(['report.pdf.kcfg']));

    const res = await deleteFile(buildContainer(), buildFile('report.pdf.kcfg'));
    expect(res.ok).toBeTrue();
  });

  it('NotFoundError以外の失敗はアプリのNotFoundErrorに変換されず、そのまま伝播する', async () => {
    fakeRootHandle = {
      removeEntry: (): Promise<void> =>
        Promise.reject(new DOMException('Permission denied.', 'NotAllowedError')),
    } as unknown as FileSystemDirectoryHandle;

    const res = await deleteFile(buildContainer(), buildFile('report.pdf.kcfg'));
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).not.toBeInstanceOf(NotFoundError);
  });
});

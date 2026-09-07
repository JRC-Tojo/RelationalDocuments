import { describe, expect, it, mock } from 'bun:test';
import type { ContainerElementFile, ContainerID } from 'src/models/container';
import type { Result } from 'src/models/error/result';
import { Failure, NotFoundError, Success } from 'src/models/error/result';
import type { DocumentConfigFile } from 'src/models/relational/fileSchema';
import type { DocumentSource } from 'src/models/document/common';

/**
 * `.kcfg`サイドカーファイルの新形式（先頭ドット付き）命名と、旧形式（先頭ドット無し）との
 * 後方互換フォールバック読み込み・移行（書き込み時の旧形式削除）ロジックを検証する
 * （Issue #93: システム固有ファイルを可能な限り隠しファイル化する対応）。
 *
 * 実際のFile System Access APIやテキストエンコード処理には依存させず、
 * `src/services/container/main`・`src/repositories/document/text`を擬似実装に差し替える
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

const FAKE_SRC = 'AAAA' as DocumentSource;

// パスをキーにした擬似ファイルストア（存在有無をテストごとに制御する）
const fakeFileStore = new Map<string, DocumentSource>();

const loadFileAsDocumentSourceMock = mock(
  (_cID: ContainerID, path: string): Promise<Result<DocumentSource>> => {
    const src = fakeFileStore.get(path);
    if (src === undefined) {
      return Promise.resolve(Failure(new NotFoundError(`not found: ${path}`)));
    }
    return Promise.resolve(Success(src));
  },
);

const createFileMock = mock(
  (_cID: ContainerID, path: string, src: DocumentSource): Promise<Result<void>> => {
    fakeFileStore.set(path, src);
    return Promise.resolve(Success());
  },
);

const deleteFileMock = mock(
  (_cID: ContainerID, file: ContainerElementFile): Promise<Result<void>> => {
    if (!fakeFileStore.has(file.path)) {
      return Promise.resolve(Failure(new NotFoundError(`not found: ${file.path}`)));
    }
    fakeFileStore.delete(file.path);
    return Promise.resolve(Success());
  },
);

void mock.module('src/services/container/main', () => ({
  loadFileAsDocumentSource: loadFileAsDocumentSourceMock,
  createFile: createFileMock,
  deleteFile: deleteFileMock,
}));

const FAKE_CONFIG: DocumentConfigFile = {
  fileHash: 'hash',
  annots: {},
  bookmarks: {},
  groups: {},
  outlineImported: false,
};

const loadTextContentsMock = mock(() => Success(FAKE_CONFIG));
const encodeTextContentsMock = mock((): Result<DocumentSource> => Success(FAKE_SRC));
void mock.module('src/repositories/document/text', () => ({
  loadTextContents: loadTextContentsMock,
  encodeTextContents: encodeTextContentsMock,
}));

const { getConfigPath, getLegacyConfigPath, getDocumentConfigFile, saveDocumentConfigFile } =
  await import('../config');

describe('文書設定ファイルのパス命名（新形式・旧形式）', () => {
  it('getConfigPathは先頭ドット付きの新形式パスを返す', () => {
    expect(getConfigPath('folder/report.pdf')).toBe('folder/.report.pdf.kcfg');
  });

  it('getLegacyConfigPathは先頭ドット無しの旧形式パスを返す（後方互換用）', () => {
    expect(getLegacyConfigPath('folder/report.pdf')).toBe('folder/report.pdf.kcfg');
  });

  it('ルート直下のファイルにも対応する', () => {
    expect(getConfigPath('report.pdf')).toBe('.report.pdf.kcfg');
    expect(getLegacyConfigPath('report.pdf')).toBe('report.pdf.kcfg');
  });
});

describe('getDocumentConfigFile（新形式優先・旧形式フォールバック読み込み）', () => {
  it('新形式のサイドカーが存在する場合はそれを読み込む', async () => {
    fakeFileStore.clear();
    fakeFileStore.set('folder/.report.pdf.kcfg', FAKE_SRC);
    loadFileAsDocumentSourceMock.mockClear();

    const res = await getDocumentConfigFile(containerID, buildFile('folder/report.pdf'));
    expect(res.ok).toBeTrue();
    expect(loadFileAsDocumentSourceMock.mock.calls.map((c) => c[1])).toEqual([
      'folder/.report.pdf.kcfg',
    ]);
  });

  it('新形式が存在せず旧形式のみ存在する場合は旧形式へフォールバックする', async () => {
    fakeFileStore.clear();
    fakeFileStore.set('folder/report.pdf.kcfg', FAKE_SRC);
    loadFileAsDocumentSourceMock.mockClear();

    const res = await getDocumentConfigFile(containerID, buildFile('folder/report.pdf'));
    expect(res.ok).toBeTrue();
    // 新形式を先に試し、NotFoundErrorだった場合のみ旧形式を試す順序であること
    expect(loadFileAsDocumentSourceMock.mock.calls.map((c) => c[1])).toEqual([
      'folder/.report.pdf.kcfg',
      'folder/report.pdf.kcfg',
    ]);
  });

  it('新形式・旧形式いずれも存在しない場合はNotFoundErrorを返す', async () => {
    fakeFileStore.clear();

    const res = await getDocumentConfigFile(containerID, buildFile('folder/report.pdf'));
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBeInstanceOf(NotFoundError);
  });

  it('明示的なパス文字列を渡した場合はフォールバックせずそのまま読み込む', async () => {
    fakeFileStore.clear();
    fakeFileStore.set('folder/report.pdf.kcfg', FAKE_SRC);
    loadFileAsDocumentSourceMock.mockClear();

    const res = await getDocumentConfigFile(containerID, 'folder/report.pdf.kcfg');
    expect(res.ok).toBeTrue();
    expect(loadFileAsDocumentSourceMock.mock.calls.map((c) => c[1])).toEqual([
      'folder/report.pdf.kcfg',
    ]);
  });
});

describe('saveDocumentConfigFile（新形式への書き込み・旧形式の移行削除）', () => {
  it('新形式のパスへ書き込み、既存の旧形式サイドカーは削除する（移行）', async () => {
    fakeFileStore.clear();
    fakeFileStore.set('folder/report.pdf.kcfg', FAKE_SRC); // 移行前の旧形式ファイル

    const res = await saveDocumentConfigFile(
      containerID,
      'folder/report.pdf',
      [],
      'hash',
      {},
      {},
      false,
    );

    expect(res.ok).toBeTrue();
    expect(fakeFileStore.has('folder/.report.pdf.kcfg')).toBeTrue();
    expect(fakeFileStore.has('folder/report.pdf.kcfg')).toBeFalse();
  });

  it('旧形式サイドカーが存在しない場合も保存自体は成功する（新規作成時等）', async () => {
    fakeFileStore.clear();

    const res = await saveDocumentConfigFile(
      containerID,
      'folder/report.pdf',
      [],
      'hash',
      {},
      {},
      false,
    );

    expect(res.ok).toBeTrue();
    expect(fakeFileStore.has('folder/.report.pdf.kcfg')).toBeTrue();
  });
});

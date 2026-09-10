/**
 * `src/services/document/textCache.ts`と`src/services/document/search.ts`のテストが共通で
 * 必要とする、より深い依存（`.kumihimo`サイドカーI/O・PDFテキスト抽出）のモックをまとめたヘルパー
 *
 * 両テストファイルがこのヘルパー経由で同じ`mock.module`登録を共有することで、同一モジュール
 * パスに対して異なる形のモックを別々に登録してしまう競合を避ける（bunの`mock.module`は
 * プロセス全体で共有され、テストファイルをまたいで残り続けるため、後から読み込まれるファイルの
 * 「本物のモジュールを読み込みたい」という意図が、先に読み込まれた別ファイルのモックに
 * 意図せず上書きされてしまうことがある。ファイル名に`.test.`を含まないため、bunの
 * テストファイル検出（`*.test.ts`）の対象にはならない）
 */
import { mock } from 'bun:test';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ContainerElementFile, ContainerID } from 'src/models/container';
import type { DocumentSource } from 'src/models/document/common';
import type { TextItemBox } from 'src/models/document/pdf';
import type { TextCacheFile } from 'src/models/document/textCache';
import { TEXT_CACHE_FORMAT_VERSION } from 'src/models/document/textCache';
import type { Result } from 'src/models/error/result';
import { Failure, NotFoundError, Success } from 'src/models/error/result';
import { fileKey, type FileIdentity } from 'src/utils/document/fileKey';

/** テストごとに書き換え可能な差し替え可能実装・状態をまとめて保持する（プロパティのミューテートのみ許可） */
export const fixtures = {
  loadFileAsDocumentSourceImpl: (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 既定実装では引数を使わない
    _cID: ContainerID,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 既定実装では引数を使わない
    _path: string,
  ): Promise<Result<DocumentSource>> => Promise.resolve(Success('dummy-src' as DocumentSource)),
  extractTextBlocksByPageFromDocImpl: (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 既定実装では引数を使わない
    _pdf: PDFDocumentProxy,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 既定実装では引数を使わない
    _pageNumber: number,
  ): Promise<Result<TextItemBox[]>> => Promise.resolve(Success([])),
  /** `extractAllTextBlocksByFileMock`の遅延時間（同時実行数の検証用） */
  extractDelayMs: 0,
  activeExtractions: 0,
  maxConcurrentExtractions: 0,
};

/** `fileKey`（containerID+path）をキーにした簡易テキストキャッシュストア（`.kumihimo/textcache/<key>.json`の代替） */
export const textCacheStore = new Map<string, TextCacheFile>();

export const getTextCacheFileMock = mock((file: FileIdentity): Promise<Result<TextCacheFile>> => {
  const found = textCacheStore.get(fileKey(file));
  return Promise.resolve(found ? Success(found) : Failure(new NotFoundError('not found')));
});

export const saveTextCacheFileMock = mock(
  (file: ContainerElementFile, pages: Map<number, TextItemBox[]>): Promise<Result<void>> => {
    const pagesRecord: Record<string, TextItemBox[]> = {};
    for (const [pageNumber, blocks] of pages) pagesRecord[String(pageNumber)] = blocks;
    textCacheStore.set(fileKey(file), {
      formatVersion: TEXT_CACHE_FORMAT_VERSION,
      path: file.path,
      fileSize: file.fileSize,
      updatedAt: file.updatedAt,
      pages: pagesRecord,
    });
    return Promise.resolve(Success());
  },
);

void mock.module('src/services/container/config', () => ({
  getTextCacheFile: getTextCacheFileMock,
  saveTextCacheFile: saveTextCacheFileMock,
}));

export const loadFileAsDocumentSourceMock = mock(
  (cID: ContainerID, path: string): Promise<Result<DocumentSource>> =>
    fixtures.loadFileAsDocumentSourceImpl(cID, path),
);

void mock.module('src/services/container/main', () => ({
  loadFileAsDocumentSource: loadFileAsDocumentSourceMock,
}));

export const extractAllTextBlocksByFileMock = mock(
  async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
    _file: FileIdentity,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
    _src64: DocumentSource,
  ): Promise<Result<Map<number, TextItemBox[]>>> => {
    fixtures.activeExtractions++;
    fixtures.maxConcurrentExtractions = Math.max(
      fixtures.maxConcurrentExtractions,
      fixtures.activeExtractions,
    );
    if (fixtures.extractDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, fixtures.extractDelayMs));
    }
    fixtures.activeExtractions--;
    return Success(new Map([[1, [{ text: 'X', x: 0, y: 0, width: 1, height: 1 }]]]));
  },
);

export const extractTextBlocksByPageFromDocMock = mock(
  (pdf: PDFDocumentProxy, pageNumber: number): Promise<Result<TextItemBox[]>> =>
    fixtures.extractTextBlocksByPageFromDocImpl(pdf, pageNumber),
);

void mock.module('src/repositories/document/pdf', () => ({
  extractAllTextBlocksByFile: extractAllTextBlocksByFileMock,
  extractTextBlocksByPageFromDoc: extractTextBlocksByPageFromDocMock,
}));

/** 各テストの冒頭で呼び、モックの呼び出し履歴・共有状態を初期状態に戻す */
export function resetTextDependencyMocks(): void {
  textCacheStore.clear();
  getTextCacheFileMock.mockClear();
  saveTextCacheFileMock.mockClear();
  loadFileAsDocumentSourceMock.mockClear();
  extractAllTextBlocksByFileMock.mockClear();
  extractTextBlocksByPageFromDocMock.mockClear();
  fixtures.loadFileAsDocumentSourceImpl = () =>
    Promise.resolve(Success('dummy-src' as DocumentSource));
  fixtures.extractTextBlocksByPageFromDocImpl = () => Promise.resolve(Success([]));
  fixtures.extractDelayMs = 0;
  fixtures.activeExtractions = 0;
  fixtures.maxConcurrentExtractions = 0;
}

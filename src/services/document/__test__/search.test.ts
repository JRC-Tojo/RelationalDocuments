import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentSource } from 'src/models/document/common';
import type { TextItemBox } from 'src/models/document/pdf';
import type { TextSearchMatch } from 'src/models/document/search';
import { Failure, Success } from 'src/models/error/result';
import type { FileIdentity } from 'src/utils/document/fileKey';
import { ContainerID } from 'src/models/container';
import {
  extractAllTextBlocksByFileMock,
  extractTextBlocksByPageFromDocMock,
  fixtures,
  getTextCacheFileMock,
  resetTextDependencyMocks,
  saveTextCacheFileMock,
} from './textDependencyMocks';

// `src/services/container/config`・`src/services/container/main`・`src/repositories/document/pdf`
// のモックは`textDependencyMocks.ts`が一括登録する（`textCache.test.ts`と共有し、同一パスへの
// 競合するモック登録を避けるため）。`src/services/document/textCache`自体はモックせず、
// 本物のキャッシュ層を通してPDF検索の分岐（`searchTextByFile`）を検証する
const { searchTextByFile, searchOpenPdfDocument } = await import('../search');

function box(text: string): TextItemBox {
  return { text, x: 0, y: 0, width: 10, height: 10 };
}

const testFile: FileIdentity = {
  containerID: ContainerID.parse('11111111-1111-4111-8111-111111111111'),
  path: 'a.pdf',
};
const DUMMY_SRC = btoa('dummy') as DocumentSource;

beforeEach(() => {
  resetTextDependencyMocks();
});

describe('searchTextByFile（拡張子ディスパッチ）', () => {
  test('クエリが空文字の場合はキャッシュ層を呼ばずSuccess([])を返す', async () => {
    const res = await searchTextByFile(testFile, DUMMY_SRC, '  ');
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual([]);
    expect(getTextCacheFileMock).not.toHaveBeenCalled();
    expect(extractAllTextBlocksByFileMock).not.toHaveBeenCalled();
  });

  test('PDF以外の拡張子は「Not supported this file type」で失敗する', async () => {
    const unsupportedFile: FileIdentity = { ...testFile, path: 'a.unsupported-ext' };
    const res = await searchTextByFile(unsupportedFile, DUMMY_SRC, 'query');
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error.message).toContain('Not supported this file type');
    expect(getTextCacheFileMock).not.toHaveBeenCalled();
  });

  test('PDFファイルの場合、キャッシュ層（本物）→抽出モックの結果を経由してマッチする', async () => {
    // キャッシュは空のため、extractAllTextBlocksByFileMock（既定で2ページ目まで返す想定はないため
    // ここでは1ページ目に'hello world'を含む結果を明示的に差し替える）経由で抽出される
    extractAllTextBlocksByFileMock.mockImplementationOnce(() =>
      Promise.resolve(Success(new Map([[1, [box('hello world')]]]))),
    );
    const onPageMatches = mock(() => {});

    const res = await searchTextByFile(testFile, DUMMY_SRC, 'world', { onPageMatches });
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toHaveLength(1);
    expect(res.value[0]?.pageNumber).toBe(1);
    expect(onPageMatches).toHaveBeenCalledTimes(1);
    // キャッシュミスにより本物のキャッシュ層が抽出結果を保存すること
    expect(saveTextCacheFileMock).toHaveBeenCalledTimes(1);
  });

  test('2回目の検索は同一ファイルのキャッシュを再利用し、抽出モックは呼ばれない', async () => {
    extractAllTextBlocksByFileMock.mockImplementationOnce(() =>
      Promise.resolve(Success(new Map([[1, [box('hello world')]]]))),
    );
    await searchTextByFile(testFile, DUMMY_SRC, 'world');
    extractAllTextBlocksByFileMock.mockClear();

    const res = await searchTextByFile(testFile, DUMMY_SRC, 'world');
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toHaveLength(1);
    expect(extractAllTextBlocksByFileMock).not.toHaveBeenCalled();
  });

  test('extraItemsByPageで渡した項目もページ内のマッチ対象に含まれる', async () => {
    extractAllTextBlocksByFileMock.mockImplementationOnce(() =>
      Promise.resolve(Success(new Map([[1, [box('hello')]]]))),
    );

    const res = await searchTextByFile(testFile, DUMMY_SRC, 'annotation-text', {
      extraItemsByPage: new Map([[1, [box('annotation-text here')]]]),
    });
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toHaveLength(1);
  });
});

describe('searchOpenPdfDocument（開いているPDFDocumentProxyに対する進捗的検索）', () => {
  const fakePdf = { numPages: 2 } as PDFDocumentProxy;

  test('クエリが空文字の場合は抽出処理を呼ばずSuccess([])を返す', async () => {
    const res = await searchOpenPdfDocument(fakePdf, '');
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual([]);
    expect(extractTextBlocksByPageFromDocMock).not.toHaveBeenCalled();
    expect(getTextCacheFileMock).not.toHaveBeenCalled();
  });

  test('永続キャッシュ層は経由せず、ページ単位で抽出しながら進捗的にマッチを返す', async () => {
    fixtures.extractTextBlocksByPageFromDocImpl = (_pdf, pageNumber) =>
      Promise.resolve(Success(pageNumber === 1 ? [box('hello world')] : [box('goodbye world')]));
    const onPageMatches = mock(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
      (_pageNumber: number, _matches: TextSearchMatch[]) => {},
    );

    const res = await searchOpenPdfDocument(fakePdf, 'world', { onPageMatches });
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(onPageMatches).toHaveBeenCalledTimes(2);
    expect(onPageMatches.mock.calls[0]?.[0]).toBe(1);
    expect(onPageMatches.mock.calls[1]?.[0]).toBe(2);
    expect(extractTextBlocksByPageFromDocMock).toHaveBeenCalledTimes(2);
    expect(getTextCacheFileMock).not.toHaveBeenCalled();
  });

  test('途中ページの抽出が失敗した場合はFailureを返す', async () => {
    const err = new Error('page extraction failed');
    fixtures.extractTextBlocksByPageFromDocImpl = () => Promise.resolve(Failure(err));

    const res = await searchOpenPdfDocument(fakePdf, 'query');
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBe(err);
  });
});

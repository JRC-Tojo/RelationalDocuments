import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Container, ContainerID } from 'src/models/container';
import type { DocumentSource } from 'src/models/document/common';
import type { TextItemBox } from 'src/models/document/pdf';
import type { Result } from 'src/models/error/result';
import { Failure, Success } from 'src/models/error/result';
import type { FileIdentity } from 'src/utils/document/fileKey';
import {
  extractAllTextBlocksByFileMock,
  fixtures,
  loadFileAsDocumentSourceMock,
  resetTextDependencyMocks,
  saveTextCacheFileMock,
} from './textDependencyMocks';

// `src/services/container/config`・`src/services/container/main`・`src/repositories/document/pdf`
// のモックは`textDependencyMocks.ts`が一括登録する（`search.test.ts`と共有し、同一パスへの
// 競合するモック登録を避けるため）。ここでは`../textCache`（本物）をそのままテストする
const { getCachedTextBlocksByFile, warmContainerTextCache } = await import('../textCache');

const testFile: FileIdentity = {
  containerID: '00000000-0000-0000-0000-000000000000' as ContainerID,
  path: 'a.pdf',
};
const DUMMY_SRC = btoa('dummy-src-bytes') as DocumentSource;

beforeEach(() => {
  resetTextDependencyMocks();
  // ファイルごとに内容（＝ハッシュ）を変え、共有ストア（ハッシュキー）上で
  // 異なるファイル同士のキャッシュが衝突しないようにする
  fixtures.loadFileAsDocumentSourceImpl = (_cID, path) =>
    Promise.resolve(Success(btoa(`dummy-src-${path}`) as DocumentSource));
});

describe('getCachedTextBlocksByFile', () => {
  test('キャッシュが無い場合、extractFreshで抽出したうえで保存し、その結果を返す', async () => {
    const extractFresh = mock((): Promise<Result<Map<number, TextItemBox[]>>> =>
      Promise.resolve(Success(new Map([[1, [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]]]))),
    );

    const res = await getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value.get(1)).toEqual([{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]);
    expect(extractFresh).toHaveBeenCalledTimes(1);
    expect(saveTextCacheFileMock).toHaveBeenCalledTimes(1);
  });

  test('キャッシュがある場合、extractFreshは呼ばれずキャッシュ内容をそのまま返す', async () => {
    const extractFresh = mock((): Promise<Result<Map<number, TextItemBox[]>>> =>
      Promise.resolve(
        Success(new Map([[1, [{ text: 'FRESH', x: 0, y: 0, width: 1, height: 1 }]]])),
      ),
    );
    // 1回目の呼び出しでキャッシュを温めておく
    await getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh);
    extractFresh.mockClear();
    saveTextCacheFileMock.mockClear();

    const res = await getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value.get(1)).toEqual([{ text: 'FRESH', x: 0, y: 0, width: 1, height: 1 }]);
    expect(extractFresh).not.toHaveBeenCalled();
    expect(saveTextCacheFileMock).not.toHaveBeenCalled();
  });

  test('extractFreshが失敗した場合はFailureを返し、保存も行わない', async () => {
    const extractError = new Error('extraction failed');
    const extractFresh = mock((): Promise<Result<Map<number, TextItemBox[]>>> =>
      Promise.resolve(Failure(extractError)),
    );

    const res = await getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh);
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBe(extractError);
    expect(saveTextCacheFileMock).not.toHaveBeenCalled();
  });

  test('キャッシュ保存に失敗しても、抽出済みの結果自体は返す（ベストエフォート）', async () => {
    saveTextCacheFileMock.mockImplementationOnce(() =>
      Promise.resolve(Failure(new Error('write failed'))),
    );
    const extractFresh = mock((): Promise<Result<Map<number, TextItemBox[]>>> =>
      Promise.resolve(Success(new Map([[1, [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]]]))),
    );

    const res = await getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value.get(1)).toEqual([{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]);
  });

  test('同一ファイルへの並行呼び出しは、抽出が1回しか走らない（二重実行防止）', async () => {
    let extractCallCount = 0;
    const extractFresh = mock(async (): Promise<Result<Map<number, TextItemBox[]>>> => {
      extractCallCount++;
      // 意図的に遅延させ、2つ目の呼び出しが「抽出中」の状態に割り込むタイミングを作る
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Success(new Map([[1, [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]]]));
    });

    const [res1, res2] = await Promise.all([
      getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh),
      getCachedTextBlocksByFile(testFile, DUMMY_SRC, extractFresh),
    ]);

    expect(res1.ok).toBeTrue();
    expect(res2.ok).toBeTrue();
    expect(extractCallCount).toBe(1);
    expect(saveTextCacheFileMock).toHaveBeenCalledTimes(1);
  });
});

describe('warmContainerTextCache', () => {
  function buildContainer(pdfCount: number, extraNonPdf = true): Container {
    const elements: Container['elements'] = {};
    for (let i = 0; i < pdfCount; i++) {
      const path = `file${i}.pdf`;
      elements[path] = {
        containerID: testFile.containerID,
        type: 'File',
        path,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    if (extraNonPdf) {
      elements['note.txt'] = {
        containerID: testFile.containerID,
        type: 'File',
        path: 'note.txt',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return {
      id: testFile.containerID,
      name: 'test',
      type: 'local',
      containerPath: '/test',
      elements,
    };
  }

  test('PDF以外のファイルは対象にしない', async () => {
    const container = buildContainer(1);

    await warmContainerTextCache(container);

    expect(loadFileAsDocumentSourceMock).toHaveBeenCalledTimes(1);
    expect(loadFileAsDocumentSourceMock.mock.calls[0]?.[1]).toBe('file0.pdf');
  });

  test('ファイルの読み込みに失敗しても他のファイルの処理は継続する（ベストエフォート）', async () => {
    const container = buildContainer(2, false);
    fixtures.loadFileAsDocumentSourceImpl = (_cID, path) =>
      path === 'file0.pdf'
        ? Promise.resolve(Failure(new Error('load failed')))
        : Promise.resolve(Success(btoa(`dummy-src-${path}`) as DocumentSource));

    await warmContainerTextCache(container);

    expect(extractAllTextBlocksByFileMock).toHaveBeenCalledTimes(1);
  });

  test('同時実行数は2件までに制限される（バックグラウンド専用の上限）', async () => {
    const container = buildContainer(5, false);
    fixtures.extractDelayMs = 30;

    await warmContainerTextCache(container);

    expect(fixtures.maxConcurrentExtractions).toBeLessThanOrEqual(2);
    expect(extractAllTextBlocksByFileMock).toHaveBeenCalledTimes(5);
  });

  test('既にキャッシュがあるファイルは抽出をスキップする', async () => {
    const container = buildContainer(1, false);
    // 1回目でキャッシュを温めておく
    await warmContainerTextCache(container);
    expect(extractAllTextBlocksByFileMock).toHaveBeenCalledTimes(1);
    extractAllTextBlocksByFileMock.mockClear();

    await warmContainerTextCache(container);
    expect(extractAllTextBlocksByFileMock).not.toHaveBeenCalled();
  });
});

import { describe, test, expect, mock } from 'bun:test';
import { buildCachedRelationalFile } from '../config';
import type { CachedRelationalFile } from 'src/models/relational/fileSchema';
import type { RelationalWithAddress } from 'src/models/relational/common';
import type { Container, ContainerElementFile, ContainerID } from 'src/models/container';
import type { AnnotationID, TextItemBox } from 'src/models/document/pdf';
import type { DocumentSource } from 'src/models/document/common';
import type { Result } from 'src/models/error/result';
import { Failure, NotFoundError, Success } from 'src/models/error/result';
import type { TextCacheFile } from 'src/models/document/textCache';
import { TEXT_CACHE_FORMAT_VERSION } from 'src/models/document/textCache';

// `getTextCacheFile`/`saveTextCacheFile`は`await import('./main')`経由でコンテナ本体の
// 取得・ファイル読み書きを行うため、`src/services/container/main`をモック化してテストする
// （`getRelationalFile`等、既存の同種サイドカーI/O関数と同じく、containerService自体は
// このモジュールのテスト対象外とする）
let containerFixture: Container | undefined;
const getContainerMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
  (_id: ContainerID): Result<Container> =>
    containerFixture !== undefined
      ? Success(containerFixture)
      : Failure(new Error('container not found')),
);
let fileSrcFixture: Result<DocumentSource> = Failure(new NotFoundError('not found'));
const loadFileAsDocumentSourceMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
  (_cID: ContainerID, _path: string): Promise<Result<DocumentSource>> =>
    Promise.resolve(fileSrcFixture),
);
const createFileMock = mock(
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
    _cID: ContainerID,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
    _path: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock.calls[N]の型付けのためだけに引数を宣言する
    _src: DocumentSource,
  ): Promise<Result<ContainerElementFile>> => Promise.resolve(Success({} as ContainerElementFile)),
);
void mock.module('src/services/container/main', () => ({
  getContainer: getContainerMock,
  loadFileAsDocumentSource: loadFileAsDocumentSourceMock,
  createFile: createFileMock,
}));

const { getTextCacheFile, saveTextCacheFile } = await import('../config');

describe('buildCachedRelationalFile', () => {
  const cID = '00000000-0000-0000-0000-000000000000' as ContainerID;
  const a = '00000000-0000-0000-0000-000000000001' as AnnotationID;
  const b = '00000000-0000-0000-0000-000000000002' as AnnotationID;
  const c = '00000000-0000-0000-0000-000000000003' as AnnotationID;
  const aAdrs = { cID, filePath: 'file1.pdf' };
  const bAdrs = { cID, filePath: 'file2.pdf' };
  const cAdrs = { cID, filePath: 'file3.pdf' };

  test('removes relationals referencing the updated document and preserves unrelated ones', () => {
    const oldFile: CachedRelationalFile = {
      annotIdToFileInfo: {
        [a]: aAdrs,
        [b]: bAdrs,
        [c]: cAdrs,
      },
      relationals: [
        { src: a, target: b, rule: { type: 'link' } },
        { src: c, target: a, rule: { type: 'equal' } },
      ],
    };

    const rs: RelationalWithAddress[] = [
      {
        relational: {
          srcID: c,
          targetID: a,
          rule: { type: 'link' },
        },
        srcAddress: cAdrs,
        targetAddress: aAdrs,
      },
    ];

    const saved = buildCachedRelationalFile(oldFile, 'file3.pdf', rs);

    expect(saved.relationals).toEqual([
      { src: a, target: b, rule: { type: 'link' } },
      { src: c, target: a, rule: { type: 'link' } },
    ]);
    expect(saved.annotIdToFileInfo).toEqual({
      [a]: aAdrs,
      [b]: bAdrs,
      [c]: cAdrs,
    });
  });

  test('deduplicates duplicate relation entries when building the cached file', () => {
    const oldFile: CachedRelationalFile = {
      annotIdToFileInfo: {
        [a]: aAdrs,
        [b]: bAdrs,
      },
      relationals: [{ src: a, target: b, rule: { type: 'link' } }],
    };

    const rs: RelationalWithAddress[] = [
      {
        relational: {
          srcID: a,
          targetID: b,
          rule: { type: 'link' },
        },
        srcAddress: aAdrs,
        targetAddress: bAdrs,
      },
      {
        relational: {
          srcID: a,
          targetID: b,
          rule: { type: 'link' },
        },
        srcAddress: aAdrs,
        targetAddress: bAdrs,
      },
    ];

    const saved = buildCachedRelationalFile(oldFile, 'file1.pdf', rs);

    expect(saved.relationals).toEqual([{ src: a, target: b, rule: { type: 'link' } }]);
    expect(saved.annotIdToFileInfo).toEqual({
      [a]: aAdrs,
      [b]: bAdrs,
    });
  });

  test('apply links from a same annotation', () => {
    const oldFile: CachedRelationalFile = {
      annotIdToFileInfo: {
        [a]: aAdrs,
      },
      relationals: [],
    };

    const rs: RelationalWithAddress[] = [
      {
        relational: {
          srcID: a,
          targetID: b,
          rule: { type: 'equal' },
        },
        srcAddress: aAdrs,
        targetAddress: bAdrs,
      },
      // file2.pdfは今回の更新対象ではないため、登録されないはず
      {
        relational: {
          srcID: b,
          targetID: c,
          rule: { type: 'link' },
        },
        srcAddress: bAdrs,
        targetAddress: cAdrs,
      },
    ];

    const saved = buildCachedRelationalFile(oldFile, 'file1.pdf', rs);

    expect(saved.relationals).toEqual([{ src: a, target: b, rule: { type: 'equal' } }]);
    expect(saved.annotIdToFileInfo).toEqual({
      [a]: aAdrs,
      [b]: bAdrs,
    });
  });

  test('remove links from a same annotation', () => {
    const oldFile: CachedRelationalFile = {
      annotIdToFileInfo: {
        [a]: aAdrs,
        [b]: bAdrs,
        [c]: cAdrs,
      },
      relationals: [
        { src: a, target: b, rule: { type: 'equal' } },
        { src: b, target: c, rule: { type: 'link' } },
        { src: c, target: a, rule: { type: 'link' } },
      ],
    };

    // file1.pdfからすべての関係性を削除した想定
    const rs: RelationalWithAddress[] = [];

    const saved = buildCachedRelationalFile(oldFile, 'file1.pdf', rs);

    expect(saved.relationals).toEqual([{ src: b, target: c, rule: { type: 'link' } }]);
    expect(saved.annotIdToFileInfo).toEqual({
      [b]: bAdrs,
      [c]: cAdrs,
    });
  });
});

describe('getTextCacheFile / saveTextCacheFile（.kumihimo/textcache/<fileHash>.json）', () => {
  const cID = '00000000-0000-0000-0000-000000000000' as ContainerID;
  const fileHash = 'a'.repeat(64);

  containerFixture = {
    id: cID,
    name: 'test-container',
    type: 'local',
    containerPath: '/test-container',
    elements: {},
  };

  test('保存済みキャッシュが存在する場合、パース済みの内容をそのまま返す', async () => {
    const stored: TextCacheFile = {
      formatVersion: TEXT_CACHE_FORMAT_VERSION,
      fileHash,
      pages: { '1': [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }] as TextItemBox[] },
    };
    fileSrcFixture = Success(
      Buffer.from(JSON.stringify(stored)).toString('base64') as DocumentSource,
    );

    const res = await getTextCacheFile(cID, fileHash);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual(stored);
  });

  test('キャッシュファイルが存在しない場合はNotFoundErrorを返す', async () => {
    fileSrcFixture = Failure(new NotFoundError('not found'));

    const res = await getTextCacheFile(cID, fileHash);
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBeInstanceOf(NotFoundError);
  });

  test('formatVersionが現行と異なる場合は「壊れたキャッシュ」としてNotFoundErrorを返す（黙って再生成させる）', async () => {
    const stored = {
      formatVersion: 999,
      fileHash,
      pages: {},
    };
    fileSrcFixture = Success(
      Buffer.from(JSON.stringify(stored)).toString('base64') as DocumentSource,
    );

    const res = await getTextCacheFile(cID, fileHash);
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBeInstanceOf(NotFoundError);
  });

  test('スキーマとして不正な内容（バリデーション失敗）の場合もNotFoundErrorを返す', async () => {
    fileSrcFixture = Success(
      Buffer.from(JSON.stringify({ not: 'a valid text cache file' })).toString(
        'base64',
      ) as DocumentSource,
    );

    const res = await getTextCacheFile(cID, fileHash);
    expect(res.ok).toBeFalse();
    if (res.ok) return;
    expect(res.error).toBeInstanceOf(NotFoundError);
  });

  test('保存時はページ番号（数値）をキー文字列に変換したJSONとしてcreateFileへ渡す', async () => {
    createFileMock.mockClear();
    const pages = new Map<number, TextItemBox[]>([
      [1, [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }]],
      [2, []],
    ]);

    const res = await saveTextCacheFile(cID, fileHash, pages);
    expect(res.ok).toBeTrue();
    expect(createFileMock).toHaveBeenCalledTimes(1);

    const [calledContainerID, calledPath, calledSrc] = createFileMock.mock.calls[0]!;
    expect(calledContainerID).toBe(cID);
    expect(calledPath).toBe(`/test-container/.kumihimo/textcache/${fileHash}.json`);

    const decoded = JSON.parse(Buffer.from(calledSrc, 'base64').toString('utf-8'));
    expect(decoded).toEqual({
      formatVersion: TEXT_CACHE_FORMAT_VERSION,
      fileHash,
      pages: {
        '1': [{ text: 'A', x: 0, y: 0, width: 1, height: 1 }],
        '2': [],
      },
    });
  });
});

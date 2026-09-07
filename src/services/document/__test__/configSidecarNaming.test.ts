import { describe, expect, it, mock } from 'bun:test';
import type {
  Container,
  ContainerElement,
  ContainerElementFile,
  ContainerID,
  RenamedEntry,
} from 'src/models/container';
import type { Result } from 'src/models/error/result';
import { Failure, NotFoundError, Success } from 'src/models/error/result';
import type { DocumentSource } from 'src/models/document/common';

/**
 * `.kcfg`サイドカーファイルに関わる以下2つの処理を検証する（Issue #93対応）：
 *
 * 1. `getFloatingConfigPaths`：新形式（先頭ドット付き）・旧形式（先頭ドット無し）いずれの
 *    サイドカー名からも、対応する文書ファイルの実在確認を正しく行えること
 * 2. `renamePath`：リネーム前に旧形式で保存されていたサイドカーも見つけて追従させ、
 *    リネーム後は新形式のパスへ揃える（移行）こと
 *
 * `services/document/config.ts`が静的にimportする各サービス（`pdf.js`に依存するものを含む）は
 * すべてモック化し、実際のFile System Access API・pdf.js・IndexedDBには依存させない
 * （`configTransaction.test.ts`と同じ方針）
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

// テストごとに書き換える擬似コンテナ（getFloatingConfigPaths・renamePathの`elementsBefore`探索対象）
let containerFixture: Container | undefined;
const getContainerMock = mock((): Result<Container> => {
  if (containerFixture === undefined) throw new Error('containerFixture is not set');
  return Success(containerFixture);
});

const renamePathMock = mock(
  (
    _cID: ContainerID,
    elem: ContainerElement,
    newPath: string,
  ): Promise<Result<RenamedEntry[]>> => {
    return Promise.resolve(
      Success([{ oldPath: elem.path, element: { ...elem, path: newPath } }]),
    );
  },
);

const deleteFileMock = mock((): Promise<Result<void>> => Promise.resolve(Success()));

void mock.module('src/services/container/main', () => ({
  getContainer: getContainerMock,
  renamePath: renamePathMock,
  deleteFile: deleteFileMock,
  loadFileAsDocumentSource: (): Promise<Result<DocumentSource>> =>
    Promise.resolve(Failure(new NotFoundError('not used in this test'))),
}));

// getConfigPath/getLegacyConfigPathは実装（models/document/common）と同じ規則をそのまま使う
const { Path } = await import('src/utils/binary/path');
const { buildConfigFileName, buildLegacyConfigFileName } = await import(
  'src/models/document/common'
);
function fakeGetConfigPath(filePath: string): string {
  const p = new Path(filePath);
  return p.parent().child(buildConfigFileName(p.basename())).path;
}
function fakeGetLegacyConfigPath(filePath: string): string {
  const p = new Path(filePath);
  return p.parent().child(buildLegacyConfigFileName(p.basename())).path;
}

const remapRelationalFilePathsMock = mock((): Promise<Result<void>> => Promise.resolve(Success()));
void mock.module('src/services/container/config', () => ({
  getConfigPath: fakeGetConfigPath,
  getLegacyConfigPath: fakeGetLegacyConfigPath,
  remapRelationalFilePaths: remapRelationalFilePathsMock,
}));

void mock.module('src/services/document/annotation', () => ({
  remapFilePath: (): Promise<Result<void>> => Promise.resolve(Success()),
}));
void mock.module('src/services/document/annotationGroup', () => ({
  remapFilePath: (): Promise<Result<void>> => Promise.resolve(Success()),
}));
void mock.module('src/services/document/relational', () => ({
  remapFilePath: (): Promise<Result<void>> => Promise.resolve(Success()),
}));
void mock.module('src/repositories/document/pdf', () => ({
  getOutline: (): Promise<Result<never[]>> => Promise.resolve(Success([])),
}));
void mock.module('src/repositories/document/pdfDocumentCache', () => ({
  invalidatePdfDocument: () => {},
}));
void mock.module('src/repositories/document/renderCache', () => ({
  invalidateRenderCache: () => {},
}));

const { getFloatingConfigPaths, renamePath } = await import('../config');

describe('getFloatingConfigPaths（新形式・旧形式いずれのサイドカーも対応先ファイルの実在確認を行う）', () => {
  it('新形式（先頭ドット付き）のサイドカーは、対応する文書が実在すれば浮いていないと判定する', () => {
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'report.pdf': buildFile('report.pdf'),
        '.report.pdf.kcfg': buildFile('.report.pdf.kcfg'),
      },
    };

    const res = getFloatingConfigPaths(buildFile('report.pdf'));
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });

  it('旧形式（先頭ドット無し）のサイドカーも、対応する文書が実在すれば浮いていないと判定する', () => {
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'report.pdf': buildFile('report.pdf'),
        'report.pdf.kcfg': buildFile('report.pdf.kcfg'),
      },
    };

    const res = getFloatingConfigPaths(buildFile('report.pdf'));
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });

  it('対応する文書ファイルが存在しないサイドカーは浮いていると判定する', () => {
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'other.pdf': buildFile('other.pdf'),
        '.deleted.pdf.kcfg': buildFile('.deleted.pdf.kcfg'),
      },
    };

    const res = getFloatingConfigPaths(buildFile('other.pdf'));
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual(['.deleted.pdf.kcfg']);
  });

  it('拡張子を持たない文書名（basenameが同じ）でも正しく対応付けられる', () => {
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        README: buildFile('README'),
        '.README.kcfg': buildFile('.README.kcfg'),
      },
    };

    const res = getFloatingConfigPaths(buildFile('README'));
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });
});

describe('renamePath（.kcfgサイドカーの追従・新形式への移行）', () => {
  it('旧形式で保存されていたサイドカーも見つけてリネームに追従させ、新形式のパスへ揃える', async () => {
    const oldFile = buildFile('old.pdf');
    const legacySidecar = buildFile('old.pdf.kcfg');
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'old.pdf': oldFile,
        'old.pdf.kcfg': legacySidecar,
      },
    };
    renamePathMock.mockClear();

    const res = await renamePath(oldFile, 'new.pdf');
    expect(res.ok).toBeTrue();
    if (!res.ok) return;

    // 1回目: 本体ファイルのリネーム、2回目: サイドカーのリネーム（新形式のパスへ）
    expect(renamePathMock).toHaveBeenCalledTimes(2);
    const sidecarCall = renamePathMock.mock.calls[1] as [ContainerID, ContainerElement, string];
    expect(sidecarCall[1].path).toBe('old.pdf.kcfg');
    expect(sidecarCall[2]).toBe('.new.pdf.kcfg');

    const renamedPaths = res.value.map((r) => r.oldPath);
    expect(renamedPaths).toContain('old.pdf.kcfg');
  });

  it('新形式で保存されていたサイドカーもリネームに追従する', async () => {
    const oldFile = buildFile('old.pdf');
    const newFormatSidecar = buildFile('.old.pdf.kcfg');
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'old.pdf': oldFile,
        '.old.pdf.kcfg': newFormatSidecar,
      },
    };
    renamePathMock.mockClear();

    const res = await renamePath(oldFile, 'new.pdf');
    expect(res.ok).toBeTrue();
    if (!res.ok) return;

    expect(renamePathMock).toHaveBeenCalledTimes(2);
    const sidecarCall = renamePathMock.mock.calls[1] as [ContainerID, ContainerElement, string];
    expect(sidecarCall[1].path).toBe('.old.pdf.kcfg');
    expect(sidecarCall[2]).toBe('.new.pdf.kcfg');
  });

  it('サイドカーが存在しない場合はリネームに追従させない（本体のみリネームされる）', async () => {
    const oldFile = buildFile('old.pdf');
    containerFixture = {
      id: containerID,
      name: 'c',
      type: 'local',
      containerPath: '/root',
      elements: {
        'old.pdf': oldFile,
      },
    };
    renamePathMock.mockClear();

    const res = await renamePath(oldFile, 'new.pdf');
    expect(res.ok).toBeTrue();
    // 本体分の1回のみで、サイドカー分のrenamePath呼び出しは発生しない
    expect(renamePathMock).toHaveBeenCalledTimes(1);
  });
});

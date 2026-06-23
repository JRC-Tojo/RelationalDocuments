/**
 * コンテナに関する操作を提供する
 */

import type {
  Container,
  ContainerElement,
  ContainerElementFile,
  ContainerType,
} from 'src/models/container';
import { ContainerID } from 'src/models/container';
import { Failure, Success, type Result } from 'src/models/error/result';
import * as cache from 'src/repositories/container/cache';
import * as box from 'src/repositories/container/box';
import * as local from 'src/repositories/container/local';
import * as settings from 'src/settings/main';
import { fromEntries } from 'src/utils/obj/obj';
import type { DocumentSource } from 'src/models/document/common';
import { Document } from 'src/models/document/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * 処理をコンテナ種別ごとに振り分ける
 */
async function switchContainerProcess<T>(
  cType: ContainerType,
  boxProcess: Promise<T>,
  localProcess: Promise<T>,
  cacheProcess: Promise<T>,
): Promise<T> {
  switch (cType) {
    case 'box':
      return await boxProcess;
    case 'cache':
      return await cacheProcess;
    case 'local':
      return await localProcess;
  }
}

let cachedContainers: { [id: ContainerID]: Container } = {};

function getContainer(id: ContainerID): Result<Container> {
  const c = cachedContainers[id];
  if (c === void 0) {
    return Failure(new Error(`Not Found Container (id: ${id})`));
  }
  return Success(c);
}

/**
 * コンテナ一覧を取得する
 *
 * コンテナ要素であるファイル情報などは未取得の状態で返す
 */
export async function getAllContainers(): Promise<Result<Container[]>> {
  const gotContainers = await Promise.all([
    cache.getContainers(),
    box.getContainers(),
    local.getContainers(),
  ]);
  const flatContainers = gotContainers.flat();
  const errContainerProvider = flatContainers.find((cs) => !cs.ok);
  if (errContainerProvider !== void 0) return errContainerProvider;

  cachedContainers = fromEntries(
    flatContainers
      .filter((cs) => cs.ok)
      .map((cs) => {
        return cs.value.map((c) => [c.id, c] as [ContainerID, Container]);
      })
      .flat(),
  );

  return Success(Object.values(cachedContainers));
}

/**
 * コンテナ情報を読み込む
 *
 * コンテナ要素まですべて読み込む
 */
export async function loadContainer(id: ContainerID): Promise<Result<Container>> {
  const c = getContainer(id);
  if (!c.ok) return c;

  // キャッシュがすでに入っている場合はそのデータを返す
  const cached = cachedContainers[c.value.id];
  if (cached?.elements !== void 0) return Success(cached);

  // コンテナ要素情報の読み取り
  const loadedContainer = await switchContainerProcess(
    c.value.type,
    box.loadContainerElements(c.value),
    local.loadContainerElements(c.value),
    cache.loadContainerElements(c.value),
  );
  if (!loadedContainer.ok) return loadedContainer;

  // キャッシュの更新
  cachedContainers[c.value.id] = loadedContainer.value;

  return loadedContainer;
}

/**
 * コンテナを追加する
 */
export async function createContainer(
  type: ContainerType,
  name: string,
  path: string,
): Promise<Result<Container>> {
  const newContainer: Container = {
    id: ContainerID.parse(uuidv4()),
    name,
    type,
    containerPath: path,
  };

  // コンテナオブジェクトの生成
  const savedRes = await switchContainerProcess(
    type,
    box.saveContainer(newContainer),
    local.saveContainer(newContainer),
    cache.saveContainer(newContainer),
  );
  if (!savedRes.ok) return savedRes;

  // キャッシュの更新
  cachedContainers[newContainer.id] = newContainer;

  // 読み込み対象一覧に追加
  const settingsRes = await settings.addLoadedContainer(newContainer);
  if (!settingsRes.ok) return settingsRes;

  // コンテナ内部のElementsの読み取り
  return loadContainer(newContainer.id);
}

/**
 * コンテナの読み込みを中止する
 */
export async function unloadContainer(cId: ContainerID): Promise<Result<void>> {
  // 読み込み対象一覧から除外
  const settingsRes = await settings.removeLoadedContainer(cId);
  if (!settingsRes.ok) return settingsRes;

  // キャッシュも削除
  delete cachedContainers[cId];

  return Success();
}

/**
 * コンテナを削除する
 */
export async function deleteContainer(id: ContainerID): Promise<Result<void>> {
  const c = getContainer(id);
  if (!c.ok) return c;

  const res = await switchContainerProcess(
    c.value.type,
    box.deleteContainer(c.value.id),
    local.deleteContainer(c.value.id),
    cache.deleteContainer(c.value.id),
  );

  if (res.ok) {
    // キャッシュから削除
    delete cachedContainers[c.value.id];
  }

  return res;
}

/**
 * コンテナ要素を追加する
 */
async function addContainerElement(
  newElement: ContainerElement,
  srcData: DocumentSource,
): Promise<Result<void>> {
  const c = getContainer(newElement.containerID);
  if (!c.ok) return c;
  if (c.value.elements === void 0) {
    return Failure(new Error('Unloaded container elements'));
  }

  // 要素を追加
  c.value.elements.push(newElement);

  // キャッシュの更新
  cachedContainers[newElement.containerID] = c.value;

  // 実態データの更新
  return switchContainerProcess(
    c.value.type,
    box.createFile(c.value, srcData),
    local.createFile(c.value, srcData),
    cache.createFile(c.value, srcData),
  );
}

/**
 * コンテナ要素を削除する
 */
async function deleteContainerElement(
  c: Container,
  deleteElement: ContainerElement,
): Promise<Result<void>> {
  if (c.elements === void 0) {
    return Failure(new Error('Unloaded container elements'));
  }

  // 要素を削除
  const targetIdx = c.elements.findIndex((e) => e.path === deleteElement.path);
  c.elements.splice(targetIdx, 1);

  // キャッシュの更新
  cachedContainers[c.id] = c;

  // 実態データの更新
  return switchContainerProcess(
    c.type,
    box.deleteFile(c, deleteElement),
    local.deleteFile(c, deleteElement),
    cache.deleteFile(c, deleteElement),
  );
}

/**
 * コンテナ内にファイルを追加する
 */
export async function createFile(
  cId: ContainerID,
  folderPath: string,
  fileName: string,
  srcData: DocumentSource,
): Promise<Result<ContainerElementFile>> {
  const element: ContainerElementFile = {
    containerID: cId,
    type: 'File',
    path: folderPath,
    name: fileName,
    fileSize: Buffer.byteLength(srcData, 'base64'),
    mimeType: fileName.split('.').pop()?.toLowerCase() || 'unknown',
    createdAt: new Date(),
    updatedAt: new Date(),
    description: '',
    genre: '',
    tags: [],
  };

  // コンテナキャッシュの更新 & 実態データの更新
  const container = await addContainerElement(element, srcData);
  if (!container.ok) return container;

  return Success(element);
}

/**
 * コンテナ内のファイルを削除する
 */
export async function deleteFile(
  cId: ContainerID,
  file: ContainerElementFile,
): Promise<Result<void>> {
  const c = getContainer(cId);
  if (!c.ok) return c;

  // コンテナキャッシュの更新 & 実態データの更新
  return deleteContainerElement(c.value, file);
}

/**
 * ファイルからドキュメントを読みこむ
 */
export async function loadFileAsDocument(file: ContainerElementFile): Promise<Result<Document>> {
  const c = getContainer(file.containerID);
  if (!c.ok) return c;

  const srcData = await switchContainerProcess(
    c.value.type,
    box.loadSrcData(file),
    local.loadSrcData(file),
    cache.loadSrcData(file),
  );

  const newDocument = Document.safeParse({
    ...file,
    src64: srcData,
  });
  if (!newDocument.success)
    return Failure(new Error(`Unsupported type of document (${file.mimeType})`));

  // TODO: PDFアノテーションをどこで読み込むか

  return Success(newDocument.data);
}

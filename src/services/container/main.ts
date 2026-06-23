/**
 * コンテナに関する操作を提供する
 */

import type { Container, ContainerElementFile, ContainerID, ContainerType } from 'src/models/container';
import { Failure, Success, type Result } from 'src/models/error/result';
import * as cache from 'src/services/container/cache';
import * as box from 'src/services/container/box';
import * as local from 'src/services/container/local';
import { fromEntries } from 'src/utils/obj/obj';
import type { Document } from 'src/models/document';

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
export async function addContainer(
  type: ContainerType,
  name: string,
  path: string,
): Promise<Result<Container>> {
  // コンテナオブジェクトの生成
  const createContainerRes = await switchContainerProcess(
    type,
    box.createContainer(name, path),
    local.createContainer(name, path),
    cache.createContainer(name, path),
  );
  if (!createContainerRes.ok) return createContainerRes;

  // キャッシュの更新
  cachedContainers[createContainerRes.value.id] = createContainerRes.value;

  // コンテナ内部のElementsの読み取り
  return loadContainer(createContainerRes.value.id);
}

/**
 * コンテナの読み込みを中止する
 */
export async function unloadContainer(id: ContainerID): Promise<Result<void>> {
  // TODO: BOXやローカルは読み込み対象一覧を記載した設定情報の更新も必要？
  return new Promise((resolve) => {
    delete cachedContainers[id];
    return resolve(Success());
  });
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
 * コンテナ内のファイルを読み込む
 */
export async function loadDocument(file: ContainerElementFile): Promise<Result<Document>> {
  const c = getContainer(file.containerID);
  if (!c.ok) return c;

  return switchContainerProcess(
    c.value.type,
    box.loadDocument(file),
    local.loadDocument(file),
    cache.loadDocument(file),
  );

}

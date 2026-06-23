/**
 * TODO: 将来的にはServiceに格上げして、Repoにはより低層の処理だけを置く？
 * （その場合、CacheはIndexedDBがすでにRepoにあるため、実装なし？）
 */

import type { ContainerElement, ContainerElementFile } from 'src/models/container';
import type { ContainerID } from 'src/models/container';
import { Container } from 'src/models/container';
import * as db from '../inMemory/IndexedDB';
import type { Result } from 'src/models/error/result';
import { Success } from 'src/models/error/result';
import { DocumentSource } from 'src/models/document/common';

/** IndexedDBに仮想のファイル群情報を持たせる */
const CACHE_STORE_NAME = 'virtual-storage';
/** IndexedDB内で指定したファイル情報の本体データを保存する */
const SOURCE_STORE_NAME = 'virtual-storage-body';
/** IndexedDB内で指定したファイル情報のアノテーションデータを保存する */
// const ANNOTATION_STORE_NAME = 'virtual-storage-annot';

/**
 * 本体データを保存するストアにおいて、本体データと紐づくキー
 */
function getDocKey(cId: ContainerID, folderPath: string, fileName: string): string {
  return `${cId}-${folderPath}/${fileName}`;
}

/**
 * 要素読み込み前のコンテナ一覧を返す
 * （IndexedDBには全データをまとめて保管しているため、要素情報もすでに入っている）
 */
export async function getContainers(): Promise<Result<Container[]>> {
  return db.getValue(CACHE_STORE_NAME, Container.array());
}

/**
 * コンテナを削除する
 */
export async function deleteContainer(id: ContainerID): Promise<Result<void>> {
  return db.deleteValue(CACHE_STORE_NAME, id);
}

/**
 * コンテナを保存する
 */
export async function saveContainer(c: Container): Promise<Result<void>> {
  return db.setValue(CACHE_STORE_NAME, c.id, c);
}

/**
 * 指定されたコンテナに最新の要素情報を注入して返す
 * Cacheでは本体データもまとめて保管しているため、何もせずに返す
 */
export async function loadContainerElements(c: Container): Promise<Result<Container>> {
  return new Promise<Result<Container>>((resolve) => resolve(Success(c)));
}

/**
 * ファイルの実態を追加する
 */
export async function createFile(c: Container, srcData: DocumentSource): Promise<Result<void>> {
  const docKey = getDocKey(c.id, c.containerPath, c.name);
  // キャッシュのみアノテーションは新規作成の際には保存しない（今後必要な場合は検討）
  return db.setValue(SOURCE_STORE_NAME, docKey, srcData);
}

/**
 * ファイルの実態を削除する
 */
export async function deleteFile(c: Container, element: ContainerElement): Promise<Result<void>> {
  const docKey = getDocKey(c.id, element.path, element.name);
  return db.deleteValue(SOURCE_STORE_NAME, docKey);
}

/**
 * ファイルの実態を読み込む
 */
export async function loadSrcData(file: ContainerElementFile): Promise<Result<DocumentSource>> {
  const docKey = getDocKey(file.containerID, file.path, file.name);
  return db.getValue(SOURCE_STORE_NAME, DocumentSource, docKey);
}

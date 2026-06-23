/**
 * TODO: 将来的にはServiceに格上げして、Repoにはより低層の処理だけを置く？
 * （その場合、CacheはIndexedDBがすでにRepoにあるため、実装なし？）
 */

import type { ContainerElement, ContainerElementFile } from 'src/models/container';
import { ContainerID } from 'src/models/container';
import { Container } from 'src/models/container';
import * as db from '../../repositories/inMemory/IndexedDB';
import type { Result } from 'src/models/error/result';
import { Failure, Success } from 'src/models/error/result';
import { Annotation, DocumentSource, type Document } from 'src/models/document';
import { v4 as uuidv4 } from 'uuid';

/** IndexedDBに仮想のファイル群情報を持たせる */
const CACHE_STORE_NAME = 'virtual-storage';
/** IndexedDB内で指定したファイル情報の本体データを保存する */
const SOURCE_STORE_NAME = 'virtual-storage-body';
/** IndexedDB内で指定したファイル情報のアノテーションデータを保存する */
const ANNOTATION_STORE_NAME = 'virtual-storage-annot';

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
 * コンテナを追加する
 *
 * コンテナ要素の読み込みは未実施
 */
export async function createContainer(name: string, path: string): Promise<Result<Container>> {
  const newContainer: Container = {
    id: ContainerID.parse(uuidv4()),
    name,
    type: 'cache',
    containerPath: path,
  };
  const res = await db.setValue(CACHE_STORE_NAME, newContainer.id, newContainer);
  if (res.ok) {
    return Success(newContainer);
  } else {
    return res;
  }
}

/**
 * 指定されたコンテナに最新の要素情報を注入して返す
 * Cacheでは本体データもまとめて保管しているため、何もせずに返す
 */
export async function loadContainerElements(c: Container): Promise<Result<Container>> {
  return new Promise<Result<Container>>((resolve) => resolve(Success(c)));
}

/**
 * コンテナ要素を追加する
 */
async function addContainerElement(
  c: Container,
  newElement: ContainerElement,
): Promise<Result<void>> {
  if (c.elements === void 0) {
    return Failure(new Error('Unloaded container elements'));
  }

  // 要素を追加
  c.elements.push(newElement);

  // 更新版のコンテナを登録
  return db.setValue(CACHE_STORE_NAME, c.id, c);
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

  // 要素を追加
  const targetIdx = c.elements.findIndex((e) => e.path === deleteElement.path);
  c.elements.splice(targetIdx, 1);

  // 更新版のコンテナを登録
  return db.setValue(CACHE_STORE_NAME, c.id, c);
}

/**
 * コンテナにファイルを追加する
 */
export async function addDocument(
  c: Container,
  folderPath: string,
  fileName: string,
  srcData: DocumentSource,
  annots: Annotation[] = [],
): Promise<Result<Document>> {
  const docKey = getDocKey(c.id, folderPath, fileName);

  const element: ContainerElementFile = {
    containerID: c.id,
    type: 'File',
    path: folderPath,
    name: fileName,
    fileSize: Buffer.byteLength(srcData, 'base64'),
    mimeType: fileName.split('.').pop() || 'unknown',
    createdAt: new Date(),
    updatedAt: new Date(),
    description: '',
    genre: '',
    tags: [],
  };

  const container = await addContainerElement(c, element);
  if (!container.ok) return container;

  const srcRes = await db.setValue(SOURCE_STORE_NAME, docKey, srcData);
  if (!srcRes.ok) return srcRes;
  const annotRes = await db.setValue(ANNOTATION_STORE_NAME, docKey, annots);
  if (!annotRes.ok) return annotRes;

  return Success({
    info: element,
    src64: srcData,
    annot: annots,
  });
}

/**
 * ファイル本体を読み込む
 */
export async function loadDocument(file: ContainerElementFile): Promise<Result<Document>> {
  const docKey = getDocKey(file.containerID, file.path, file.name);

  const annots = await db.getValue(ANNOTATION_STORE_NAME, Annotation.array(), docKey);
  const base64Data = await db.getValue(SOURCE_STORE_NAME, DocumentSource, docKey);
  if (!base64Data.ok) return base64Data;
  if (!annots.ok) return annots;

  return Success({
    info: file,
    src64: base64Data.value,
    annot: annots.value,
  });
}

/**
 * ファイル本体を保存する
 */
export async function saveDocument(doc: Document): Promise<Result<void>> {
  const docKey = getDocKey(doc.info.containerID, doc.info.path, doc.info.name);

  const annotRes = await db.setValue(ANNOTATION_STORE_NAME, docKey, doc.annot);
  if (!annotRes.ok) return annotRes;
  const srcRes = await db.setValue(SOURCE_STORE_NAME, docKey, doc.src64);
  if (!srcRes.ok) return srcRes;

  return Success();
}

/**
 * ファイル本体を削除する
 */
export async function deleteDocument(doc: Document): Promise<Result<void>> {
  const docKey = getDocKey(doc.info.containerID, doc.info.path, doc.info.name);

  const container = await db.getValue(CACHE_STORE_NAME, Container, doc.info.containerID);
  if (!container.ok) return container;
  const delRes = await deleteContainerElement(container.value, doc.info);
  if (!delRes.ok) return delRes;

  const annotRes = await db.deleteValue(ANNOTATION_STORE_NAME, docKey);
  if (!annotRes.ok) return annotRes;
  const srcRes = await db.deleteValue(SOURCE_STORE_NAME, docKey);
  if (!srcRes.ok) return srcRes;

  return Success();
}

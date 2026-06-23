import type { ContainerElementFile } from 'src/models/container';
import { ContainerID, type Container } from 'src/models/container';
import type { Document } from 'src/models/document';
import { DocumentSource } from 'src/models/document';
import type { Result } from 'src/models/error/result';
import { Success } from 'src/models/error/result';
import { v4 as uuidv4 } from 'uuid';

/**
 * Boxに保存されたコンテナを取得する
 */
export async function getContainers(): Promise<Result<Container[]>> {
  return new Promise((resolve) => resolve(Success([])));
}

/**
 * Boxに保存されたコンテナを削除する
 */
export async function deleteContainer(id: string): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * Boxに保存されたコンテナを追加する
 */
export async function createContainer(name: string, path: string): Promise<Result<Container>> {
  const newContainer: Container = {
    id: ContainerID.parse(uuidv4()),
    name,
    type: 'box',
    containerPath: path,
  };

  // TODO: Boxに実際に保存する処理を追加する

  return new Promise((resolve) => resolve(Success(newContainer)));
}

/**
 * Boxに保存されたコンテナの要素情報を取得する
 */
export async function loadContainerElements(c: Container): Promise<Result<Container>> {
  return new Promise((resolve) => resolve(Success(c)));
}

/**
 * Boxに保存されたコンテナの要素情報を削除する
 */
export async function deleteContainerElement(c: Container): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * Boxに保存されたコンテナの要素情報を追加する
 */
export async function addContainerElement(c: Container): Promise<Result<Container>> {
  return new Promise((resolve) => resolve(Success(c)));
}

/**
 * ファイル本体を読み込む
 */
export async function loadDocument(file: ContainerElementFile): Promise<Result<Document>> {
  return new Promise((resolve) =>
    resolve(
      Success({
        info: file,
        src64: DocumentSource.parse(''),
        annot: [],
      }),
    ),
  );
}

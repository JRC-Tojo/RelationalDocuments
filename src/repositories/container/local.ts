/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ContainerElement, ContainerElementFile } from 'src/models/container';
import { type Container } from 'src/models/container';
import type { DocumentSource } from 'src/models/document/common';
import type { Result } from 'src/models/error/result';
import { Success } from 'src/models/error/result';

/**
 * ローカルに保存されたコンテナを取得する
 */
export async function getContainers(): Promise<Result<Container[]>> {
  return new Promise((resolve) => resolve(Success([])));
}

/**
 * ローカルに保存されたコンテナを削除する
 */
export async function deleteContainer(id: string): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * ローカルにデータを保存する
 */
export async function saveContainer(c: Container): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * ローカルに保存されたコンテナの要素情報を取得する
 */
export async function loadContainerElements(c: Container): Promise<Result<Container>> {
  return new Promise((resolve) => resolve(Success(c)));
}

/**
 * ローカルにファイルの実態を追加する
 */
export async function createFile(c: Container, srcData: DocumentSource): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * ローカルからファイルの実態を削除する
 */
export async function deleteFile(c: Container, element: ContainerElement): Promise<Result<void>> {
  return new Promise((resolve) => resolve(Success()));
}

/**
 * ローカルにファイルの実態を読み込む
 */
export async function loadSrcData(file: ContainerElementFile): Promise<Result<DocumentSource>> {
  return new Promise((resolve) => resolve(Success()));
}

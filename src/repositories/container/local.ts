/**
 * ローカルフォルダに文書を保存する
 *
 * TODO: 戻り値や引数は未定
 */

import type { Result } from 'src/models/error/result';
import { Success } from 'src/models/error/result';

/**
 * 指定したフォルダ内の全ファイルを取得
 */
export async function getFiles(recursive: boolean = false): Promise<Result<void>> {
  return Success();
}

/**
 * 指定したファイルの保存
 */
export async function saveFile(): Promise<Result<void>> {
  return Success();
}

/**
 * 指定したファイルの取得
 *
 * - 型情報（Zod）を指定すればその型の戻り値を得る
 * - 指定しなければDocumnetSource(=base64)型の戻り値を得る
 */
export async function readFile(): Promise<Result<void>> {
  return Success();
}

/**
 * 指定したファイルを削除
 */
export async function deleteFile(): Promise<Result<void>> {
  return Success();
}

/**
 * 指定したフォルダを作成
 */
export async function createFolder(): Promise<Result<void>> {
  return Success();
}

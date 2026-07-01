/**
 * アノテーション情報を起動中にわたり管理する
 *
 * アノテーション情報をDBに保存しているため、DBへのアクセスヘルパーとしての実装
 */

import type { ContainerElementFile } from 'src/models/container';
import type { AnnotationID, AnnotationStyle } from 'src/models/document/pdf';
import type { Result } from 'src/models/error/result';

// TODO: 将来的に対応するファイル種別が増えた場合はクラス化し、抽象関数を実装していくだけ、というようにする？

/**
 * アノテーションDBを初期ロードする
 */
export async function loadAnnotations() {
  // コンテナのルートに保存しているDBを読み込む

  // 仮設置フラグがついているアノテーションは破棄する

  // 対象ファイルが見つからない、対象ページにアノテーションが見つからない、場合は警告を出す？
  // ---> 本体コードは警告のみで、ワークフローとしてこのような場合に使える「アノテーション追跡」を提供？

  // TODO: 実データ側にしか存在しないアノテーションの扱い
}

/**
 * PDFファイルのアノテーション一覧を返す
 */
export async function getPdfAnnotations(
  file: ContainerElementFile,
): Promise<Result<AnnotationStyle[]>> {
  // SQLのように(ContainerID, path)の一致をまとめて取得、というようにしたい
  // 取得した状態ではAny型として、AnnotationStyleでパースしたものを返す実装
}

/**
 * PDFファイルのアノテーションを追加する
 *
 * 登録済みのAnnotationIDであった場合は上書きされる
 */
export async function registPdfAnnotation(newAnnot: AnnotationStyle): Promise<Result<void>> {}

/**
 * アノテーションを削除する
 */
export async function removeAnnotation(annotID: AnnotationID): Promise<Result<void>> {}

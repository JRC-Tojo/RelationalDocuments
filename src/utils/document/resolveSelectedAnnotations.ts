/**
 * 選択中アノテーションIDの実体解決（DB購読の反映を待たない版）
 *
 * `DocumentTabView.vue`の`selectedAnnotations`計算・DB購読（liveQuery）コールバックが共通で使う
 * ロジックを、Vueコンポーネントから切り離してテスト可能にしたもの。DB購読（liveQuery）による
 * 確定済み一覧（`annotations`）だけでなく、ローカルで最後に意図した書き込み内容
 * （`annotationWritePending.ts`の`getPendingAnnotationStyle`）があれば常にそちらを優先する。
 *
 * これにより、まだDB購読側の一覧に現れていない新規作成直後のアノテーション（関係性ボタンの
 * 表示可否等、選択中アノテーションの実体に依存する判定）や、スタイルパネルでの編集中の内容
 * （色変更等）を、永続化（`.kcfg`・アノテーションDBへの書き込み）の完了を待たず即座に
 * 反映できるようにする（Issue #109: アノテーション描画後・編集後の各種操作の遅延対策）
 */
import type { AnnotationID, AnnotationStyle } from 'src/models/document/pdf';
import { getPendingAnnotationStyle } from './annotationWritePending';

/**
 * 選択中ID一覧を、実体（AnnotationStyle）へ解決する
 *
 * 各IDについて、ローカルで最後に意図した書き込み内容（`getPendingAnnotationStyle`）があれば
 * それを優先し、無ければDB購読由来の確定済み一覧（`confirmed`）から探す。どちらにも
 * 存在しないID（既に削除された等）は結果から除外する
 */
export function resolveSelectedAnnotations(
  selectedIds: AnnotationID[],
  confirmed: AnnotationStyle[],
): AnnotationStyle[] {
  return selectedIds
    .map((id) => getPendingAnnotationStyle(id) ?? confirmed.find((a) => a.id === id))
    .filter((a): a is AnnotationStyle => a !== undefined);
}

/**
 * 指定IDが、DB購読由来の確定済み一覧またはローカルの書き込み意図のいずれかに存在するかどうかを返す
 *
 * DB購読（liveQuery）コールバックが選択中ID一覧から「もう存在しないID」を取り除く際に使う。
 * ローカルで書き込みを意図した（＝いずれ必ずDB購読側にも現れるはずの）新規作成分を、
 * DB購読が追いつく前のタイミングで誤って選択から取りこぼさないようにする
 */
export function isSelectableAnnotationId(id: AnnotationID, confirmed: AnnotationStyle[]): boolean {
  return confirmed.some((a) => a.id === id) || getPendingAnnotationStyle(id) !== undefined;
}

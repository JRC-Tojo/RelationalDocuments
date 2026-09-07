/**
 * アノテーションIDごとに「ローカルで最後に発行した書き込みが意図している内容」を保持する、
 * 共有のリアクティブ状態
 *
 * アノテーションDBへの書き込みはファイル単位で発行順に直列実行される
 * （`services/document/annotation.ts`の`annotationFileMutex`）ため、DB自体は常に発行順に
 * 確定する。しかしDB購読（liveQuery）側への反映は書き込みが確定するたびに個別に、かつ
 * 「書き込みを依頼したPromiseが解決したタイミング」から幾らか遅れて非同期に発火する
 * （Dexieの変更通知は書き込みトランザクションの完了とは別のマイクロタスクで実行されるため）。
 * そのため「自分の書き込みが完了した」ことと「その内容がDB購読経由でUIから見えるように
 * なった」ことは同じタイミングではない。この間に届く更新（過去の書き込みの遅れたエコー、
 * まだ自分の最新の書き込みに追いついていない状態）をそのまま表示してしまうと、確定して
 * 見えていた変更が一瞬古い状態へ巻き戻ってから追いつく（ちらつく）挙動になる。
 *
 * これを避けるため、ローカルで「この内容で書き込む」と発行するたびに、対象アノテーションIDに
 * 対する『最後に自分が意図した内容』（`updatedAt`の目印と、実際に書き込もうとしているスタイルの
 * 内容そのもの）を記録しておく。`updatedAt`はローカルの編集のたびに新しく発行されるISO文字列で、
 * 書き込み経路の途中（author補完等）で書き換えられることが無いため、個々の編集を一意に識別する
 * 目印として使える。DB購読由来の更新は、この目印と`updatedAt`が完全一致するもの（＝自分が
 * 最後に意図した書き込みの確定エコー）が届くまで無視し、一致した時点で初めて反映してよい
 * （`resolveAnnotationEcho`）。目印が無いID（このセッションでローカル書き込みを行っていない、
 * または既に確定済み）への更新は、他ユーザー・プラグイン・OCR再読込等の外部由来の変更として
 * 即座に反映してよい。
 *
 * 新しい/古いといった時系列の前後は一切見ない点が重要で、Undo/Redoのように意図的に
 * 本来より古い`updatedAt`を持つ内容へ書き戻す操作であっても、その書き込みの発行時に目印を
 * 更新するため（`useAnnotationHistory.ts`のregisterStyleTracked等参照）、「自分が最後に
 * 意図した内容とちょうど一致するかどうか」だけで正しく判定できる。
 *
 * さらに、意図した内容そのもの（`style`）を保持していることを利用し、DB確定・DB購読の反映を
 * 一切待たずに「今まさに書き込もうとしている内容」を画面へ即座に反映するためにも使う
 * （`getPendingAnnotationStyle`。スタイルパネルでの色変更等、Issue #109の反映遅延対策）。
 * 新規作成直後、まだDB購読側の一覧に一切現れていないアノテーションについても、IDさえ分かれば
 * この内容を参照して実体を解決できる（関係性ボタンの表示可否判定等）
 */
import { reactive } from 'vue';
import type { AnnotationID, AnnotationStyle } from 'src/models/document/pdf';

/** アノテーションIDごとの「最後にローカルで意図した書き込み内容」 */
const pendingWrites = reactive(new Map<AnnotationID, AnnotationStyle>());

/**
 * 指定スタイルの内容でローカルに書き込みを発行する直前に呼び、意図した内容の目印を記録する
 *
 * `style`そのものを保持することで、DB確定・DB購読側の反映を待たずに`getPendingAnnotationStyle`
 * 経由で画面へ即座に反映できるようにする
 */
export function markAnnotationWriteIntent(style: AnnotationStyle): void {
  pendingWrites.set(style.id, style);
}

/**
 * 指定IDへの書き込みが失敗した場合に呼ぶ
 *
 * その書き込みが依然として「最後に意図した内容」のままであれば（＝この後により新しい書き込みが
 * 発行されていなければ）目印を取り消し、DB購読側の更新を再び素通しできるようにする。既により
 * 新しい書き込みが発行済みであれば、それはそちらの書き込みの目印であり自分が取り消す対象では
 * ないため、何もしない
 */
export function cancelAnnotationWriteIntent(id: AnnotationID, updatedAt: string): void {
  if (pendingWrites.get(id)?.updatedAt === updatedAt) pendingWrites.delete(id);
}

/**
 * DB購読由来の更新`next`をUIへ反映してよいかどうかを判定する
 *
 * 反映してよい場合はtrueを返し、目印を消費する（以後このIDへの目印は無くなり、次に届く
 * 更新からは素通しに戻る）。まだ自分の意図した内容に追いついていない場合はfalseを返し、
 * 呼び出し側はこの更新を無視すること。リアクティブなMapへの`get`呼び出しのため、
 * Vueのwatch/computed内で呼べばリアクティブに追跡される
 */
export function resolveAnnotationEcho(next: AnnotationStyle): boolean {
  const intended = pendingWrites.get(next.id);
  if (intended === undefined) return true;
  if (intended.updatedAt !== next.updatedAt) return false;
  pendingWrites.delete(next.id);
  return true;
}

/**
 * 指定IDについて、ローカルで最後に意図した書き込み内容をDB確定を待たずに返す
 *
 * 存在しなければ`undefined`（このセッションでローカル書き込みを行っていない、または
 * 既にDB購読側の反映まで確定済み）。新規作成直後でまだDB購読側の一覧に現れていない
 * アノテーションの実体解決（関係性ボタンの表示可否判定等）や、スタイルパネルでの編集内容を
 * 永続化の完了を待たずに即座に画面へ反映する用途に使う。リアクティブなMapへの`get`呼び出しの
 * ため、Vueのwatch/computed内で呼べばリアクティブに追跡される
 */
export function getPendingAnnotationStyle(id: AnnotationID): AnnotationStyle | undefined {
  return pendingWrites.get(id);
}

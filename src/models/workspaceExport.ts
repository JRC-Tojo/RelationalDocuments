import z from 'zod';
import { RecentContainerEntry } from './container';

/**
 * 「最近使用したコンテナ」一覧のエクスポート/インポート用スキーマ
 *
 * ブラウザ版とデスクトップアプリ版はIndexedDBのオリジンが異なるため、設定を直接共有できない。
 * フォルダへの実アクセス権（`FileSystemDirectoryHandle`）自体は環境をまたいで引き継げないが、
 * 「どのフォルダを使っていたか」という記憶（名前・種別・最終利用日時）はJSON化して引き継げる
 * ため、それだけを対象とする。アノテーション・関係性の実データは文書と同じ場所（`.kcfg`・
 * `.kumihimo/relational.json`）に保存されており、同じフォルダを開き直せば自動的に引き継がれる
 * ため、このスキーマの対象外
 */
export const WorkspaceExport = z.object({
  exportedAt: z.coerce.date(),
  recentContainers: RecentContainerEntry.array(),
});
export type WorkspaceExport = z.infer<typeof WorkspaceExport>;

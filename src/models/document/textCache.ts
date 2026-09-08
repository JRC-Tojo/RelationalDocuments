import z from 'zod';
import { TextItemBox } from 'src/models/document/pdf';

/**
 * `.kumihimo/textcache/<fileHash>.json`として保存する、1文書分のテキストレイヤーキャッシュ
 *
 * ページ番号（1始まり）をキーとした`TextItemBox`一覧を保持する。ファイル内容が変わると
 * `fileHash`（ファイル名にも使われるsha256ハッシュ）が変わるため、無効化は「別ファイルとして
 * 扱われる」ことで自然に行われる（明示的な無効化処理は不要）。
 *
 * `.kcfg`や`relational.json`と異なり、このキャッシュは失っても実データを損なわない
 * 使い捨て・再生成可能なデータであるため、`formatVersion`を持たせ、パース失敗や
 * バージョン不一致は「キャッシュなし」として扱い黙って再生成する（既存の`.optional().default()`
 * 方式とは異なる、キャッシュファイル特有の方針）
 */
export const TextCacheFile = z.object({
  formatVersion: z.literal(1),
  fileHash: z.hash('sha256'),
  pages: z.record(z.string(), TextItemBox.array()),
});
export type TextCacheFile = z.infer<typeof TextCacheFile>;

/** 現在サポートしているキャッシュファイルのフォーマットバージョン */
export const TEXT_CACHE_FORMAT_VERSION = 1;

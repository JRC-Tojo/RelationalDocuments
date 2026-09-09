import z from 'zod';
import { TextItemBox } from 'src/models/document/pdf';

/**
 * `.kumihimo/textcache/<key>.json`として保存する、1文書分のテキストレイヤーキャッシュ
 *
 * ページ番号（1始まり）をキーとした`TextItemBox`一覧を保持する。有効性は`path`・`updatedAt`
 * （・`fileSize`）が対象ファイルの現在の値と一致するかで判定する（`src/services/document/
 * textCache.ts`の`isCacheFresh`参照）。ファイル内容のハッシュを使わないのは、大きなPDFでも
 * 本体を読み込まずに（コンテナのファイル一覧から既に判明している`updatedAt`・`fileSize`のみで）
 * 有効性を判定できるようにするため。更新日時を変えずに内容だけ書き換えるような稀なケースでは
 * 古いキャッシュを見誤って使う可能性があるが、検索結果を失うだけで実データには影響しないため
 * 許容する。
 *
 * `.kcfg`や`relational.json`と異なり、このキャッシュは失っても実データを損なわない
 * 使い捨て・再生成可能なデータであるため、`formatVersion`を持たせ、パース失敗や
 * バージョン不一致は「キャッシュなし」として扱い黙って再生成する（既存の`.optional().default()`
 * 方式とは異なる、キャッシュファイル特有の方針）
 */
export const TextCacheFile = z.object({
  formatVersion: z.literal(2),
  path: z.string(),
  fileSize: z.number().int().nonnegative().optional(),
  updatedAt: z.coerce.date(),
  pages: z.record(z.string(), TextItemBox.array()),
});
export type TextCacheFile = z.infer<typeof TextCacheFile>;

/**
 * `TextCacheFile`から`pages`を除いたメタ情報のみのスキーマ
 *
 * 大きな文書では`pages`が数十万件の`TextItemBox`を含み得るため、要素単位でzod検証すると
 * 読み込みだけで秒単位の時間がかかることがある（検索が「キャッシュ済みのはずなのに毎回遅い」
 * 不具合の実測上の主要因だった）。読み込み側（`getTextCacheFile`）はこの軽量スキーマで
 * メタ情報のみを検証し、`pages`は自前で書き出した信頼済みデータとして型キャストのみで扱う
 */
export const TextCacheFileMeta = TextCacheFile.omit({ pages: true });
export type TextCacheFileMeta = z.infer<typeof TextCacheFileMeta>;

/** 現在サポートしているキャッシュファイルのフォーマットバージョン */
export const TEXT_CACHE_FORMAT_VERSION = 2;

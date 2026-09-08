/**
 * 文書のテキストレイヤー（ページごとの位置情報付きテキスト）を、`.kumihimo`フォルダに
 * ファイルハッシュ単位で永続キャッシュするサービス
 *
 * コンテナ横断検索は検索のたびに対象ファイル全件のテキストレイヤーを必要とするが、毎回PDFを
 * 開いて`getTextContent()`をやり直すと、ファイルが多い・重いコンテナほど遅くなる。ここでは
 * ファイル内容のハッシュ（`calcBase64Hash`）をキーに抽出結果を`.kumihimo/textcache/<hash>.json`
 * として保存し、2回目以降は同じ内容のファイルに対する抽出をスキップできるようにする。
 *
 * `getCachedTextBlocksByFile`は特定の文書形式（PDF等）に依存しない：キャッシュが無い場合に
 * 実際の抽出を行う関数（`extractFresh`）を呼び出し元から受け取ることで、将来PDF以外の
 * 文書形式が増えてもこの関数自体を変更せずに再利用できる
 */
import type { Container, ContainerElementFile } from 'src/models/container';
import { Success, type Result } from 'src/models/error/result';
import type { TextItemBox } from 'src/models/document/pdf';
import { calcBase64Hash } from 'src/utils/binary/base64';
import { createConcurrencyLimiter } from 'src/utils/promise/concurrent';
import { createKeyedMutex } from 'src/utils/promise/keyedMutex';
import type { DocumentSource } from 'src/models/document/common';
import { fileKey, type FileIdentity } from 'src/utils/document/fileKey';
import * as containerService from 'src/services/container/main';
import * as containerConfigService from 'src/services/container/config';
import * as pdfRepo from 'src/repositories/document/pdf';
import { isPdfContainerFile } from 'src/utils/document/supportedTypes';

/**
 * ファイル単位で読み込み→抽出→書き込みを直列化するミューテックス（モジュールスコープの単一インスタンス）
 *
 * バックグラウンドのウォームアップ（`warmContainerTextCache`）と前景検索（`search.ts`）が
 * 同じファイルに同時にヒットしても、この仕組みにより後から来た方は先発の処理完了を待った上で
 * （既に書き込まれた）キャッシュをそのまま読むだけになり、PDFの抽出処理が二重に走ることはない
 */
const textCacheFileMutex = createKeyedMutex();

/**
 * 指定ファイルのページごとテキストブロックを取得する（キャッシュがあれば利用し、無ければ
 * `extractFresh`で抽出したうえでキャッシュへ保存する）
 *
 * 検索・プラグインのテキストレイヤー参照等、文書のテキストレイヤーを扱う様々な処理から
 * 共通して使えるよう、PDF固有の抽出処理には依存しない設計とする
 */
export async function getCachedTextBlocksByFile(
  file: FileIdentity,
  src64: DocumentSource,
  extractFresh: (
    file: FileIdentity,
    src64: DocumentSource,
  ) => Promise<Result<Map<number, TextItemBox[]>>>,
): Promise<Result<Map<number, TextItemBox[]>>> {
  return textCacheFileMutex.runExclusive(fileKey(file), async () => {
    const hashRes = await calcBase64Hash(src64);
    if (!hashRes.ok) return hashRes;

    const cachedRes = await containerConfigService.getTextCacheFile(
      file.containerID,
      hashRes.value,
    );
    if (cachedRes.ok) return Success(recordToPageMap(cachedRes.value.pages));
    // キャッシュ不存在・破損のいずれであっても、ここではベストエフォートで抽出へフォールバックする
    // （キャッシュ読み込み障害だけを理由に検索自体を失敗させない）

    const extractedRes = await extractFresh(file, src64);
    if (!extractedRes.ok) return extractedRes;

    const saveRes = await containerConfigService.saveTextCacheFile(
      file.containerID,
      hashRes.value,
      extractedRes.value,
    );
    if (!saveRes.ok) {
      console.warn('Failed to persist text cache (best-effort):', saveRes.error);
    }

    return Success(extractedRes.value);
  });
}

/** `TextCacheFile.pages`（ページ番号文字列キーのRecord）を`Map<number, TextItemBox[]>`へ変換する */
function recordToPageMap(pages: Record<string, TextItemBox[]>): Map<number, TextItemBox[]> {
  const map = new Map<number, TextItemBox[]>();
  for (const [pageNumberStr, blocks] of Object.entries(pages)) {
    map.set(Number(pageNumberStr), blocks);
  }
  return map;
}

/**
 * バックグラウンドのキャッシュウォームアップ専用の同時実行数上限
 *
 * コンテナ横断検索用の`CONTAINER_SEARCH_CONCURRENCY`（前景・ユーザー待機あり）とは別枠とし、
 * バックグラウンド処理がCPU・メモリを食いつぶして他の操作を圧迫しないよう小さめに絞る
 */
const TEXT_CACHE_WARM_CONCURRENCY = 2;

/**
 * `textCacheWarmLimiter`はモジュールスコープの単一インスタンスとする：複数コンテナが同時に
 * ロードされて`warmContainerTextCache`が並行して呼ばれても、コンテナ横断で同時実行数の
 * 上限を共有する（コンテナツリー読み込みの`fileStatLimiter`と同じ考え方）
 */
const textCacheWarmLimiter = createConcurrencyLimiter(TEXT_CACHE_WARM_CONCURRENCY);

/**
 * コンテナ内の全PDFファイルについて、未キャッシュのものをバックグラウンドで温める
 *
 * 各ファイルの読み込み・抽出に失敗しても他のファイルの処理には影響させない（ベストエフォート）。
 * 既にキャッシュが存在するファイルは`getCachedTextBlocksByFile`内の軽いサイドカー読み込みのみで
 * 即座に終わるため、再読み込みのたびに呼んでも大きなコストにはならない
 */
export async function warmContainerTextCache(container: Container): Promise<void> {
  const pdfFiles = Object.values(container.elements).filter(isPdfContainerFile);

  await Promise.all(
    pdfFiles.map((file: ContainerElementFile) =>
      textCacheWarmLimiter(async () => {
        const srcRes = await containerService.loadFileAsDocumentSource(file.containerID, file.path);
        if (!srcRes.ok) return;
        await getCachedTextBlocksByFile(file, srcRes.value, pdfRepo.extractAllTextBlocksByFile);
      }),
    ),
  );
}

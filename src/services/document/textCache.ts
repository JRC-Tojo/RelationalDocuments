/**
 * 文書のテキストレイヤー（ページごとの位置情報付きテキスト）を、`.kumihimo`フォルダに
 * ファイル単位で永続キャッシュするサービス
 *
 * コンテナ横断検索は検索のたびに対象ファイル全件のテキストレイヤーを必要とするが、毎回PDFを
 * 開いて`getTextContent()`をやり直すと、ファイルが多い・重いコンテナほど遅くなる。ここでは
 * 抽出結果を`.kumihimo/textcache/<key>.json`として保存し、2回目以降は同じファイルに対する
 * 抽出をスキップできるようにする。
 *
 * キャッシュの有効性は、ファイル内容のハッシュではなく`ContainerElementFile.updatedAt`
 * （・`fileSize`）で判定する（`isCacheFresh`）。これらはコンテナのファイル一覧（ディレクトリ
 * 走査）の時点で既に判明しているメタ情報であり、判定のためにファイル本体を読み込む必要が無い。
 * キャッシュが最新と判定できた場合は本体の読み込み（`loadSrc`）自体を一切呼ばないため、大きな
 * PDFでも本体読み込み・ハッシュ計算のコストが発生しない
 *
 * `getCachedTextBlocksByFile`は特定の文書形式（PDF等）に依存しない：キャッシュが無い場合に
 * 実際の抽出を行う関数（`extractFresh`）を呼び出し元から受け取ることで、将来PDF以外の
 * 文書形式が増えてもこの関数自体を変更せずに再利用できる
 */
import type { Container, ContainerElementFile } from 'src/models/container';
import { Success, type Result } from 'src/models/error/result';
import type { TextItemBox } from 'src/models/document/pdf';
import type { TextCacheFile } from 'src/models/document/textCache';
import { createConcurrencyLimiter } from 'src/utils/promise/concurrent';
import { createKeyedMutex } from 'src/utils/promise/keyedMutex';
import type { DocumentSource } from 'src/models/document/common';
import { fileKey } from 'src/utils/document/fileKey';
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
 * 実際にファイル本体を読み込んで抽出する処理（`loadSrc`＋`extractFresh`）専用の同時実行数上限
 *
 * バックグラウンドウォームアップ（`warmContainerTextCache`。ディスパッチ数は
 * `TEXT_CACHE_WARM_CONCURRENCY`件まで）と前景検索（`backendApi.ts`の
 * `CONTAINER_SEARCH_CONCURRENCY`件までディスパッチ）は、どちらも最終的にこの関数を経由する。
 * 外側の各リミッターは「同時に何件のファイル処理をディスパッチするか」を絞っているに過ぎず、
 * それぞれの上限を単純に足し合わせると合計の同時PDF解析数（重いCPU・メモリ処理）が
 * 跳ね上がってしまう（起動直後にウォームアップと検索が重なるとタブがフリーズ・クラッシュする
 * 一因だった）。実際に重い処理を行うこの一点で絞ることで、両者を合算した同時実行数が
 * 意図した上限を超えないことを保証する
 */
const PDF_EXTRACTION_CONCURRENCY = 3;
const pdfExtractionLimiter = createConcurrencyLimiter(PDF_EXTRACTION_CONCURRENCY);

/**
 * 指定ファイルのページごとテキストブロックを取得する（キャッシュが最新なら利用し、無ければ
 * `loadSrc`でファイル本体を取得したうえで`extractFresh`で抽出し、キャッシュへ保存する）
 *
 * 検索・プラグインのテキストレイヤー参照等、文書のテキストレイヤーを扱う様々な処理から
 * 共通して使えるよう、PDF固有の抽出処理には依存しない設計とする
 */
export async function getCachedTextBlocksByFile(
  file: ContainerElementFile,
  loadSrc: () => Promise<Result<DocumentSource>>,
  extractFresh: (
    file: ContainerElementFile,
    src64: DocumentSource,
  ) => Promise<Result<Map<number, TextItemBox[]>>>,
): Promise<Result<Map<number, TextItemBox[]>>> {
  return textCacheFileMutex.runExclusive(fileKey(file), async () => {
    const cachedRes = await containerConfigService.getTextCacheFile(file);
    if (cachedRes.ok && isCacheFresh(cachedRes.value, file)) {
      return Success(recordToPageMap(cachedRes.value.pages));
    }
    // キャッシュ不存在・古い・破損のいずれであっても、ここではベストエフォートで抽出へ
    // フォールバックする（キャッシュ読み込み障害だけを理由に検索自体を失敗させない）

    return pdfExtractionLimiter(async () => {
      const srcRes = await loadSrc();
      if (!srcRes.ok) return srcRes;

      const extractedRes = await extractFresh(file, srcRes.value);
      if (!extractedRes.ok) return extractedRes;

      const saveRes = await containerConfigService.saveTextCacheFile(file, extractedRes.value);
      if (!saveRes.ok) {
        console.warn('Failed to persist text cache (best-effort):', saveRes.error);
      }

      return Success(extractedRes.value);
    });
  });
}

/**
 * キャッシュが現在のファイル状態と一致し、有効と判定できるかどうかを返す
 *
 * `updatedAt`が一致しない場合は無条件で無効。`fileSize`は双方が既知の場合のみ比較する
 * （`box`型コンテナ等、将来`fileSize`を持たないファイルが出てきても`updatedAt`だけで判定できる）
 */
function isCacheFresh(cache: TextCacheFile, file: ContainerElementFile): boolean {
  if (cache.updatedAt.getTime() !== file.updatedAt.getTime()) return false;
  if (
    file.fileSize !== undefined &&
    cache.fileSize !== undefined &&
    cache.fileSize !== file.fileSize
  ) {
    return false;
  }
  return true;
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
 * 現在実行中の検索処理の数（同時に複数の検索呼び出しが重なる場合に備え、真偽値ではなく
 * カウンタで管理する。`beginSearchInterrupt`/`endSearchInterrupt`は対で呼ぶこと）
 *
 * 起動直後などまだキャッシュが少ない状態でユーザーが即座に検索を使うと、検索自身のPDF抽出
 * （`CONTAINER_SEARCH_CONCURRENCY`）とバックグラウンドウォームアップ（`TEXT_CACHE_WARM_CONCURRENCY`）
 * が同時に走り、重いPDF解析が二重に積み上がってタブがフリーズ・クラッシュしかねない。検索実行中
 * （このカウンタが1以上）は`warmContainerTextCache`側でまだ着手していないファイルの処理を
 * 打ち切ることで、検索処理へCPU・メモリの余地を譲る。既にウォームアップでキャッシュ保存済みの
 * ファイルは、検索処理自身が`getCachedTextBlocksByFile`内でそのキャッシュを見つけて利用する
 */
let activeSearchCount = 0;

/** 検索処理の開始を通知する（対応する`endSearchInterrupt`と対で呼ぶこと） */
export function beginSearchInterrupt(): void {
  activeSearchCount++;
}

/** 検索処理の終了を通知する */
export function endSearchInterrupt(): void {
  activeSearchCount = Math.max(0, activeSearchCount - 1);
}

/**
 * バックグラウンドのキャッシュウォームアップ専用の同時実行数上限（ディスパッチ数の上限）
 *
 * コンテナ横断検索用の`CONTAINER_SEARCH_CONCURRENCY`（前景・ユーザー待機あり）とは別枠とし、
 * バックグラウンド処理がCPU・メモリを食いつぶして他の操作を圧迫しないよう小さめに絞る。
 * 実際に重い処理（ファイル本体の読み込み・抽出）は`pdfExtractionLimiter`でさらに絞られるため、
 * ここでの上限は「キャッシュ有効性チェック（軽いサイドカー読み込み）を同時に何件走らせるか」の
 * 意味合いが大きい
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
 * キャッシュが最新（`updatedAt`・`fileSize`が一致）と判定できたファイルは、
 * `getCachedTextBlocksByFile`内で`loadSrc`（PDF本体の読み込み）自体が呼ばれないため、
 * コンテナ再読み込みのたびに呼んでもほぼコストがかからない
 */
export async function warmContainerTextCache(container: Container): Promise<void> {
  const pdfFiles = Object.values(container.elements).filter(isPdfContainerFile);

  await Promise.all(
    pdfFiles.map((file: ContainerElementFile) =>
      textCacheWarmLimiter(async () => {
        // 検索が実行中なら、まだ着手していないファイルの処理はここで打ち切る（既に着手済みの
        // 分は完了させる。中断時点の抽出結果を捨てるのは無駄なため）
        if (activeSearchCount > 0) return;
        await getCachedTextBlocksByFile(
          file,
          () => containerService.loadFileAsDocumentSource(file.containerID, file.path),
          pdfRepo.extractAllTextBlocksByFile,
        );
      }),
    ),
  );
}

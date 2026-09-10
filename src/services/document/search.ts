/**
 * 文書のテキスト検索（クエリマッチング）を行うサービス
 *
 * リポジトリ層（`src/repositories/document/pdf.ts`）は「所定のデータを抽出・整形して返す」
 * ことのみを責務とし、クエリを受け取ってマッチ箇所を求める処理はここに一本化する。
 *
 * `searchTextByFile`は文書パスの拡張子から形式を判定し（`getSupportedDocumentKind`）、
 * 形式ごとの実装へ委譲するディスパッチ構造とする。今回対応するのはPDFのみだが、将来他形式の
 * 文書にも同じ入口から検索できるようにするための設計（`src/services/document/config.ts`の
 * `trackAnnotation`が拡張子でswitchしている既存パターンを踏襲）
 */
import type { DocumentSource } from 'src/models/document/common';
import { Failure, Success, type Result } from 'src/models/error/result';
import type { ContainerElementFile } from 'src/models/container';
import type { TextItemBox } from 'src/models/document/pdf';
import type { TextSearchMatch, TextSearchOptions } from 'src/models/document/search';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findMatchesOnPage } from 'src/utils/document/textSearch';
import { getSupportedDocumentKind } from 'src/utils/document/supportedTypes';
import * as pdfRepo from 'src/repositories/document/pdf';
import * as textCacheService from 'src/services/document/textCache';

export interface SearchTextInDocOptions {
  /** 大文字小文字・半角全角・正規表現の扱い（省略時は従来どおりの既定値） */
  searchOptions?: Partial<TextSearchOptions> | undefined;
  /**
   * ページごとの追加検索対象を`TextItemBox`と同じ形で渡す（アノテーションのテキストボックス内容等、
   * PDF自体のテキストではないが検索対象に含めたい文字列）。同一ページのPDFテキストと連結して
   * 検索されるため、アイテム境界をまたぐマッチにも対応する
   */
  extraItemsByPage?: Map<number, TextItemBox[]> | undefined;
  /**
   * 1ページ分の検索が完了するたびに、そのページのマッチ結果とともに呼ばれる。
   * ページ数の多い巨大な文書を検索する際、全ページの完了を待たずヒットした時点から
   * 呼び出し側（UI）へ反映できるようにするためのフック
   */
  onPageMatches?: ((pageNumber: number, matches: TextSearchMatch[]) => void) | undefined;
}

/**
 * 「開いていない」文書ファイルを対象にした検索（コンテナ横断検索・単一文書検索から使用）
 *
 * ファイル形式ごとにディスパッチする。今後PDF以外の文書形式に対応する場合は、ここに
 * caseを追加し専用の実装関数へ委譲すればよい
 */
export async function searchTextByFile(
  file: ContainerElementFile,
  loadSrc: () => Promise<Result<DocumentSource>>,
  query: string,
  options: SearchTextInDocOptions = {},
): Promise<Result<TextSearchMatch[]>> {
  if (query.trim() === '') return Success([]);
  switch (getSupportedDocumentKind(file.path)) {
    case 'pdf':
      return searchPdfFile(file, loadSrc, query, options);
    default:
      return Failure(new Error(`Not supported this file type (${file.path})`));
  }
}

/**
 * PDFファイルを対象にした検索の実装。`textCacheService.getCachedTextBlocksByFile`経由で
 * ページごとテキストブロックを取得するため、キャッシュが最新なら`loadSrc`を呼ばずPDF自体を
 * 開かずに済む
 */
async function searchPdfFile(
  file: ContainerElementFile,
  loadSrc: () => Promise<Result<DocumentSource>>,
  query: string,
  options: SearchTextInDocOptions,
): Promise<Result<TextSearchMatch[]>> {
  const blocksRes = await textCacheService.getCachedTextBlocksByFile(
    file,
    loadSrc,
    pdfRepo.extractAllTextBlocksByFile,
  );
  if (!blocksRes.ok) return blocksRes;

  const matches: TextSearchMatch[] = [];
  // 永続キャッシュから復元した`blocksRes.value`はページ番号が1..Nで連続している保証がないため、
  // `Map.size`をページ数とみなさず、抽出済みページとextraItemsByPageのページ番号の和集合を
  // 昇順で走査する（抜けたページのブロック・アノテーション文字列が検索対象から漏れるのを防ぐ）
  const pageNumbers = [
    ...new Set([...blocksRes.value.keys(), ...(options.extraItemsByPage?.keys() ?? [])]),
  ].sort((a, b) => a - b);
  for (const pageNumber of pageNumbers) {
    const blocks = blocksRes.value.get(pageNumber) ?? [];
    const extraItems = options.extraItemsByPage?.get(pageNumber) ?? [];
    const pageMatches = findMatchesOnPage(
      [...blocks, ...extraItems],
      pageNumber,
      query,
      options.searchOptions,
    );
    matches.push(...pageMatches);
    options.onPageMatches?.(pageNumber, pageMatches);
  }
  return Success(matches);
}

/**
 * 既に開いている`PDFDocumentProxy`を対象にした検索（ビューアのCtrl+F、`pdfManager.ts`専用）
 *
 * 永続キャッシュは経由せず、ページ単位で`extractTextBlocksByPageFromDoc`（リポジトリ層、
 * ページ単位WeakMapキャッシュが効く）を呼びながら進捗的にマッチを返す（巨大文書でも
 * 先頭ページから即座にヒットを表示するため、全ページ抽出の完了を待たない）
 */
export async function searchOpenPdfDocument(
  pdf: PDFDocumentProxy,
  query: string,
  options: SearchTextInDocOptions = {},
): Promise<Result<TextSearchMatch[]>> {
  if (query.trim() === '') return Success([]);
  const matches: TextSearchMatch[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const blocksRes = await pdfRepo.extractTextBlocksByPageFromDoc(pdf, pageNumber);
    if (!blocksRes.ok) return Failure(blocksRes.error);
    const extraItems = options.extraItemsByPage?.get(pageNumber) ?? [];
    const pageMatches = findMatchesOnPage(
      [...blocksRes.value, ...extraItems],
      pageNumber,
      query,
      options.searchOptions,
    );
    matches.push(...pageMatches);
    options.onPageMatches?.(pageNumber, pageMatches);
  }
  return Success(matches);
}

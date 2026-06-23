/**
 * PDFデータのDocumnetSourceを受け取って、内容の読み取りや編集を行う
 *
 * TODO: テストの追加
 *
 * - 関数ベースで実装
 * - 読み取り系（テキスト抽出、ページレンダリング、領域切り出し）を標準実装
 * - 変更系（ページ追加/削除、PDFへのアノテーション埋め込み）は `pdf-lib` を利用して実装
 */

import { getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import type { Annotation, DocumentSource } from '../../models/document/common';
import type { Result } from '../../models/error/result';
import { Success, Failure } from '../../models/error/result';

/** ヘルパー: base64 -> Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:.*;base64,/, '');
  const binaryString = atob(cleaned);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

/** ヘルパー: Uint8Array -> base64 (純粋な base64 を返す) */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** PDF をロードして PDFDocumentProxy を返す（Result でラップ） */
export async function loadPdfFromSrc64(src64: DocumentSource): Promise<Result<PDFDocumentProxy>> {
  try {
    const data = base64ToUint8Array(src64 as unknown as string);
    const loadingTask = getDocument({ data });
    // some pdfjs builds type the loadingTask.promise differently; cast to any to await reliably
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf: PDFDocumentProxy = await (loadingTask.promise as any);
    return Success(pdf);
  } catch (e) {
    return Failure(toError(e));
  }
}

/** ページ数を取得する */
export async function getNumPages(src64: DocumentSource): Promise<Result<number>> {
  const loaded = await loadPdfFromSrc64(src64);
  if (!loaded.ok) return Failure(loaded.error);
  try {
    return Success(loaded.value.numPages);
  } catch (e) {
    return Failure(toError(e));
  }
}

/** 指定ページのテキストを抽出する（簡易） */
export async function extractTextByPage(
  src64: DocumentSource,
  pageNumber: number,
): Promise<Result<string>> {
  const loaded = await loadPdfFromSrc64(src64);
  if (!loaded.ok) return Failure(loaded.error);
  try {
    const page = await loaded.value.getPage(pageNumber);
    const textContent = await page.getTextContent();
    // items の型がバラつくため最小限に処理
    const strings = (textContent.items as Array<{ str?: string }>).map((it) =>
      typeof it.str === 'string' ? it.str : '',
    );
    return Success(strings.join(' '));
  } catch (e) {
    return Failure(toError(e));
  }
}

/** 全ページのテキストを抽出する（ページごとの配列を返す） */
export async function extractAllText(src64: DocumentSource): Promise<Result<string[]>> {
  const loaded = await loadPdfFromSrc64(src64);
  if (!loaded.ok) return Failure(loaded.error);
  try {
    const pages: string[] = [];
    for (let i = 1; i <= loaded.value.numPages; i++) {
      // await を順に行う — 大きな PDF は並列化を検討
      const pageText = await extractTextByPage(src64, i);
      if (!pageText.ok) return Failure(pageText.error);
      pages.push(pageText.value);
    }
    return Success(pages);
  } catch (e) {
    return Failure(toError(e));
  }
}

/** 指定ページをレンダリングして Canvas を返す（ブラウザ環境向け） */
export async function renderPageToCanvas(
  src64: DocumentSource,
  pageNumber: number,
  scale = 1,
): Promise<Result<HTMLCanvasElement>> {
  const loaded = await loadPdfFromSrc64(src64);
  if (!loaded.ok) return Failure(loaded.error);
  try {
    const page = await loaded.value.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return Failure(new Error('Canvas 2D context is not available'));

    // pdfjs render task may expose a promise property in many builds
    // keep a minimal local shape for type-safety
    type PdfRenderTask = { promise?: Promise<unknown> };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderTask = (page as any).render({ canvasContext: ctx, viewport }) as PdfRenderTask;
    if (renderTask?.promise) await renderTask.promise;
    return Success(canvas);
  } catch (e) {
    return Failure(toError(e));
  }
}

/** 指定ページの矩形領域を切り出して PNG の dataURL を返す。Result でラップ。
 * rect は PDF のページ座標系 (left, top) を想定する（0,0 は左上）
 */
export async function extractImageFromRegion(
  src64: DocumentSource,
  pageNumber: number,
  rect: { x: number; y: number; width: number; height: number },
  scale = 2,
): Promise<Result<string>> {
  try {
    const rendered = await renderPageToCanvas(src64, pageNumber, scale);
    if (!rendered.ok) return Failure(rendered.error);
    const canvas = rendered.value;

    const tmp = document.createElement('canvas');
    tmp.width = Math.round(rect.width * scale);
    tmp.height = Math.round(rect.height * scale);
    const tctx = tmp.getContext('2d');
    if (!tctx) return Failure(new Error('Canvas 2D context is not available'));

    tctx.drawImage(
      canvas,
      Math.round(rect.x * scale),
      Math.round(rect.y * scale),
      Math.round(rect.width * scale),
      Math.round(rect.height * scale),
      0,
      0,
      Math.round(rect.width * scale),
      Math.round(rect.height * scale),
    );
    return Success(tmp.toDataURL('image/png'));
  } catch (e) {
    return Failure(toError(e));
  }
}

/** PDF バイナリを base64 にして返す */
function uint8ToDocSrc(bytes: Uint8Array): DocumentSource {
  return uint8ArrayToBase64(bytes) as unknown as DocumentSource;
}

/** ページの追加 */
export async function addBlankPageToPdf(
  src64: DocumentSource,
  width = 595,
  height = 842,
): Promise<Result<DocumentSource>> {
  try {
    const bytes = base64ToUint8Array(src64 as unknown as string);
    const pdfDoc = await PDFDocument.load(bytes);
    pdfDoc.addPage([width, height]);
    const out = await pdfDoc.save();
    return Success(uint8ToDocSrc(out));
  } catch (e) {
    return Failure(toError(e));
  }
}

/** ページを削除（0始まりのインデックス） */
export async function removePageFromPdf(
  src64: DocumentSource,
  pageIndexZeroBased: number,
): Promise<Result<DocumentSource>> {
  try {
    const bytes = base64ToUint8Array(src64 as unknown as string);
    const pdfDoc = await PDFDocument.load(bytes);
    const pageCount = pdfDoc.getPageCount();
    if (pageIndexZeroBased < 0 || pageIndexZeroBased >= pageCount)
      return Failure(new Error('page index out of range'));
    pdfDoc.removePage(pageIndexZeroBased);
    const out = await pdfDoc.save();
    return Success(uint8ToDocSrc(out));
  } catch (e) {
    return Failure(toError(e));
  }
}

/**
 * PDF にアノテーションを焼き込む。Annotation 型に応じて矩形や線、円を描画する。
 * 返り値は編集後の DocumentSource を Result で返す
 */
export async function embedAnnotationsIntoPdf(
  src64: DocumentSource,
  annotations: Annotation[],
): Promise<Result<DocumentSource>> {
  try {
    const bytes = base64ToUint8Array(src64 as unknown as string);
    const pdfDoc = await PDFDocument.load(bytes);

    function hexToRgb(hex: string) {
      const h = hex.replace('#', '');
      const bigint = parseInt(
        h.length === 3
          ? h
              .split('')
              .map((c) => c + c)
              .join('')
          : h,
        16,
      );
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return { r: r / 255, g: g / 255, b: b / 255 };
    }

    for (const a of annotations) {
      const pageIndex = a.pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;
      const page = pdfDoc.getPage(pageIndex);

      const color = hexToRgb(a.color || '#ff0000');
      const opacity = typeof a.opacity === 'number' ? a.opacity : 1;
      const strokeWidth = a.strokeWidth ?? 2;

      if (a.type === 'box') {
        const { x, y, width, height } = a as unknown as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        const pageHeight = page.getSize().height;
        page.drawRectangle({
          x,
          y: pageHeight - y - height,
          width,
          height,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: strokeWidth,
          color: undefined,
          opacity,
        });
      } else if (a.type === 'line') {
        const { x, y, x2, y2 } = a as unknown as { x: number; y: number; x2: number; y2: number };
        const pageHeight = page.getSize().height;
        page.drawLine({
          start: { x, y: pageHeight - y },
          end: { x: x2, y: pageHeight - y2 },
          thickness: strokeWidth,
          color: rgb(color.r, color.g, color.b),
        });
      } else if (a.type === 'circle') {
        const { x, y, radius } = a as unknown as { x: number; y: number; radius: number };
        const pageHeight = page.getSize().height;
        page.drawEllipse({
          x,
          y: pageHeight - y,
          xScale: radius,
          yScale: radius,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: strokeWidth,
          color: undefined,
          opacity,
        });
      }
    }

    const out = await pdfDoc.save();
    return Success(uint8ToDocSrc(out));
  } catch (e) {
    return Failure(toError(e));
  }
}

// Export まとめ
export default {
  loadPdfFromSrc64,
  getNumPages,
  extractTextByPage,
  extractAllText,
  renderPageToCanvas,
  extractImageFromRegion,
  addBlankPageToPdf,
  removePageFromPdf,
  embedAnnotationsIntoPdf,
};

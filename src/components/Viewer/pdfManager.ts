/**
 * PDF エディタサービス
 * アノテーション管理とPDF操作の統合サービス
 */

import * as pdfjsLib from 'pdfjs-dist';

export type PdfDocument = pdfjsLib.PDFDocumentProxy;

/**
 * PDF.jsワーカーを初期化
 */
function initWorker() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();
}

/**
 * PDFファイルを読み込む
 */
export async function loadPdf(pdfPath: string): Promise<PdfDocument> {
  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (error) {
    throw new Error(`PDF読み込みエラー: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * ページをCanvasにレンダリング
 */
export async function renderPage(
  pdfDocument: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1,
  maxWidth: number = 0,
): Promise<void> {
  try {
    const page = await pdfDocument.getPage(pageNumber);
    let viewport = page.getViewport({ scale });
    if (maxWidth !== 0) {
      viewport = page.getViewport({ scale: maxWidth / viewport.width });
    }

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context not available');
    }

    // 高解像度ディスプレイ（Retina等）対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    // レンダリングコンテキストをDPRに合わせてスケール
    context.scale(dpr, dpr);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  } catch (error) {
    throw new Error(
      `ページレンダリングエラー: ${error instanceof Error ? error.message : 'Unknown'}`,
    );
  }
}

export async function generateThumbnail(
  pdfDocument: PdfDocument,
  pageNumber: number,
  maxWidth: number = 120,
): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    await renderPage(pdfDocument, pageNumber, canvas, 1, maxWidth);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error(
      `Thumbnail generation error: ${error instanceof Error ? error.message : 'Unknown'}`,
    );
    return '';
  }
}

// ワーカー初期化
initWorker();

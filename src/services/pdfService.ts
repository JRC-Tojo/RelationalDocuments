/**
 * PDF エディタサービス
 * アノテーション管理とPDF操作の統合サービス
 */

import { v4 as uuidv4 } from 'uuid';
import * as pdfjsLib from 'pdfjs-dist';

export interface Annotation {
  id: string;
  type: 'highlight' | 'line' | 'box' | 'circle' | 'image';
  pageNumber: number;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  opacity?: number;
  content?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PDFInfo {
  pageCount: number;
  title: string;
  fileName: string;
}

/**
 * PDF管理クラス
 */
export class PdfManager {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  private annotations: Annotation[] = [];

  /**
   * PDF.jsワーカーを初期化
   */
  static initWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).toString();
  }

  /**
   * PDFファイルを読み込む
   */
  async loadPdf(pdfPath: string): Promise<PDFInfo> {
    try {
      const response = await fetch(pdfPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      return {
        pageCount: this.pdfDocument.numPages,
        title: (this.pdfDocument.fingerprints?.[0] as unknown as string)?.toString() || 'Unknown',
        fileName: pdfPath.split('/').pop() || 'document.pdf',
      };
    } catch (error) {
      throw new Error(`PDF読み込みエラー: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * ページをCanvasにレンダリング
   */
  async renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 1,
  ): Promise<void> {
    if (!this.pdfDocument) {
      throw new Error('PDF document not loaded');
    }

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context not available');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

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

  /**
   * ページのサムネイルを生成
   */
  async generateThumbnail(pageNumber: number, maxWidth: number = 120): Promise<string> {
    if (!this.pdfDocument) {
      throw new Error('PDF document not loaded');
    }

    try {
      const canvas = document.createElement('canvas');
      const page = await this.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: maxWidth / page.getViewport({ scale: 1 }).width });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context not available');
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error(
        `Thumbnail generation error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return '';
    }
  }

  /**
   * アノテーションを追加
   */
  addAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
    const newAnnotation: Annotation = {
      ...annotation,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.annotations.push(newAnnotation);
    return newAnnotation;
  }

  /**
   * アノテーションを更新
   */
  updateAnnotation(id: string, updates: Partial<Annotation>): Annotation | null {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) return null;

    const current = this.annotations[index];
    if (!current) return null;

    this.annotations[index] = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };

    return this.annotations[index] || null;
  }

  /**
   * アノテーションを削除
   */
  deleteAnnotation(id: string): boolean {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) return false;

    this.annotations.splice(index, 1);
    return true;
  }

  /**
   * ページのアノテーションを取得
   */
  getPageAnnotations(pageNumber: number): Annotation[] {
    return this.annotations.filter((a) => a.pageNumber === pageNumber);
  }

  /**
   * すべてのアノテーションを取得
   */
  getAllAnnotations(): Annotation[] {
    return [...this.annotations];
  }

  /**
   * アノテーションをローカルストレージに保存
   */
  saveAnnotationsToStorage(documentId: string): void {
    const key = `pdf_annotations_${documentId}`;
    localStorage.setItem(key, JSON.stringify(this.annotations));
  }

  /**
   * アノテーションをローカルストレージから読み込む
   */
  loadAnnotationsFromStorage(documentId: string): void {
    const key = `pdf_annotations_${documentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      this.annotations = JSON.parse(stored, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
    }
  }

  /**
   * アノテーションをエクスポート
   */
  exportAnnotations(): string {
    return JSON.stringify(this.annotations, null, 2);
  }

  /**
   * アノテーションをインポート
   */
  importAnnotations(jsonData: string): void {
    try {
      this.annotations = JSON.parse(jsonData, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      throw new Error(
        `アノテーションのインポートに失敗しました: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * 終了処理
   */
  cleanup(): void {
    void this.pdfDocument?.cleanup?.();
    this.pdfDocument = null;
    this.annotations = [];
  }
}

/**
 * グローバルPdfManager インスタンス
 */
export const pdfManager = new PdfManager();

// ワーカー初期化
PdfManager.initWorker();

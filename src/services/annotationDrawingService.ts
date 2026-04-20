/**
 * アノテーション描画マネージャー
 * PDFページ上でのアノテーション描画とマウス操作を管理
 */

import { v4 as uuidv4 } from 'uuid';
import { pdfManager, type Annotation } from './pdfService';

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  type: Annotation['type'];
  color: string;
  pageNumber: number;
}

/**
 * アノテーション描画マネージャークラス
 */
export class AnnotationDrawingManager {
  private drawingState: DrawingState | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private svgElement: SVGSVGElement | null = null;
  private annotationCreatedCallback: ((annotation: Annotation) => void) | null = null;
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: (() => void) | null = null;

  /**
   * 描画マネージャーを初期化
   */
  initialize(canvas: HTMLCanvasElement, svg: SVGSVGElement) {
    this.canvas = canvas;
    this.svgElement = svg;

    // マウスイベントリスナーを追加
    this.mouseDownHandler = (e: MouseEvent) => this.handleMouseDown(e);
    this.mouseMoveHandler = (e: MouseEvent) => this.handleMouseMove(e);
    this.mouseUpHandler = () => this.handleMouseUp();

    canvas.addEventListener('mousedown', this.mouseDownHandler);
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  /**
   * アノテーション作成コールバックを設定
   */
  setAnnotationCreatedCallback(callback: (annotation: Annotation) => void) {
    this.annotationCreatedCallback = callback;
  }

  /**
   * マウスダウンイベント処理
   */
  private handleMouseDown(event: MouseEvent) {
    if (!this.canvas || !this.svgElement) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.drawingState = {
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      type: 'highlight', // デフォルトは highlight (後で外部から設定)
      color: '#FFD700', // デフォルト色 (後で外部から設定)
      pageNumber: 1, // 後で外部から設定
    };
  }

  /**
   * マウスムーブイベント処理
   */
  private handleMouseMove(event: MouseEvent) {
    if (!this.drawingState?.isDrawing || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.drawingState.currentX = event.clientX - rect.left;
    this.drawingState.currentY = event.clientY - rect.top;

    // プレビュー描画
    this.drawPreview();
  }

  /**
   * マウスアップイベント処理
   */
  private handleMouseUp() {
    if (!this.drawingState?.isDrawing) return;

    const annotation = this.createAnnotationFromState();
    if (annotation) {
      pdfManager.addAnnotation(annotation);
      if (this.annotationCreatedCallback) {
        this.annotationCreatedCallback(annotation);
      }
    }

    this.drawingState = null;
  }

  /**
   * 描画状態からアノテーションを作成
   */
  private createAnnotationFromState(): Annotation | null {
    if (!this.drawingState) return null;

    const { startX, startY, currentX, currentY, type, color, pageNumber } = this.drawingState;

    if (type === 'line') {
      return {
        id: uuidv4(),
        type: 'line',
        pageNumber,
        x: startX,
        y: startY,
        x2: currentX,
        y2: currentY,
        color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    if (type === 'circle') {
      const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
      return {
        id: uuidv4(),
        type: 'circle',
        pageNumber,
        x: startX,
        y: startY,
        radius,
        color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // highlight, box
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    if (width < 5 || height < 5) return null; // 最小サイズチェック

    const annotation: Annotation = {
      id: uuidv4(),
      type: type === 'box' ? 'box' : 'highlight',
      pageNumber,
      x,
      y,
      width,
      height,
      color,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (type === 'highlight') {
      annotation.opacity = 0.3;
    }

    return annotation;
  }

  /**
   * プレビューを描画
   */
  private drawPreview() {
    if (!this.svgElement || !this.drawingState) return;

    // 既存のプレビュー要素を削除
    const existingPreview = this.svgElement.querySelector('.preview-annotation');
    if (existingPreview) {
      existingPreview.remove();
    }

    const { startX, startY, currentX, currentY, type, color } = this.drawingState;

    if (type === 'line') {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'preview-annotation');
      line.setAttribute('x1', startX.toString());
      line.setAttribute('y1', startY.toString());
      line.setAttribute('x2', currentX.toString());
      line.setAttribute('y2', currentY.toString());
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5,5');
      this.svgElement.appendChild(line);
    } else if (type === 'circle') {
      const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'preview-annotation');
      circle.setAttribute('cx', startX.toString());
      circle.setAttribute('cy', startY.toString());
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('stroke-dasharray', '5,5');
      this.svgElement.appendChild(circle);
    } else {
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'preview-annotation');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', width.toString());
      rect.setAttribute('height', height.toString());

      if (type === 'highlight') {
        rect.setAttribute('fill', color);
        rect.setAttribute('opacity', '0.3');
      } else {
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '5,5');
      }

      this.svgElement.appendChild(rect);
    }
  }

  /**
   * 描画タイプを設定
   */
  setDrawingType(type: Annotation['type']) {
    if (this.drawingState) {
      this.drawingState.type = type;
    }
  }

  /**
   * 色を設定
   */
  setColor(color: string) {
    if (this.drawingState) {
      this.drawingState.color = color;
    }
  }

  /**
   * ページ番号を設定
   */
  setPageNumber(pageNumber: number) {
    if (this.drawingState) {
      this.drawingState.pageNumber = pageNumber;
    }
  }

  /**
   * 描画状態を確認
   */
  isDrawing(): boolean {
    return this.drawingState?.isDrawing ?? false;
  }

  /**
   * 終了処理
   */
  destroy() {
    if (this.canvas && this.mouseDownHandler) {
      this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
    }
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler);
    }
    this.drawingState = null;
    this.canvas = null;
    this.svgElement = null;
  }
}

/**
 * アノテーション操作ユーティリティ
 */
export class AnnotationOperations {
  /**
   * 指定された領域内のすべてのアノテーションを取得
   */
  static findInRegion(
    annotations: Annotation[],
    x: number,
    y: number,
    width: number,
    height: number,
  ): Annotation[] {
    return annotations.filter((annotation) => {
      // Highlight and Box
      if (annotation.width !== undefined && annotation.height !== undefined) {
        const aX = annotation.x;
        const aY = annotation.y;
        const aWidth = annotation.width;
        const aHeight = annotation.height;
        return aX < x + width && aX + aWidth > x && aY < y + height && aY + aHeight > y;
      }

      // Line
      if (annotation.x2 !== undefined && annotation.y2 !== undefined) {
        const distance = this.pointToLineDistance(
          x + width / 2,
          y + height / 2,
          annotation.x,
          annotation.y,
          annotation.x2,
          annotation.y2,
        );
        return distance < 20; // 20px以内を対象
      }

      // Circle
      if (annotation.radius !== undefined) {
        const distance = Math.sqrt(
          Math.pow(annotation.x - (x + width / 2), 2) +
            Math.pow(annotation.y - (y + height / 2), 2),
        );
        return distance < annotation.radius + 20;
      }

      return false;
    });
  }

  /**
   * ページ内のすべてのアノテーションを取得
   */
  static getAnnotationsByPage(annotations: Annotation[], pageNumber: number): Annotation[] {
    return annotations.filter((a) => a.pageNumber === pageNumber);
  }

  /**
   * 色でフィルタリング
   */
  static filterByColor(annotations: Annotation[], color: string): Annotation[] {
    return annotations.filter((a) => a.color === color);
  }

  /**
   * タイプでフィルタリング
   */
  static filterByType(annotations: Annotation[], type: Annotation['type']): Annotation[] {
    return annotations.filter((a) => a.type === type);
  }

  /**
   * 日付範囲内のアノテーションを取得
   */
  static filterByDateRange(
    annotations: Annotation[],
    startDate: Date,
    endDate: Date,
  ): Annotation[] {
    return annotations.filter((a) => {
      const createdTime = new Date(a.createdAt).getTime();
      return createdTime >= startDate.getTime() && createdTime <= endDate.getTime();
    });
  }

  /**
   * 点からラインまでの距離を計算
   */
  private static pointToLineDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx: number;
    let yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 重複するアノテーション境界を拡張
   */
  static expandOverlapRegion(
    annotations: Annotation[],
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number,
    expandAmount: number,
  ): Annotation[] {
    const expanded = {
      x: regionX - expandAmount,
      y: regionY - expandAmount,
      width: regionWidth + expandAmount * 2,
      height: regionHeight + expandAmount * 2,
    };

    return this.findInRegion(annotations, expanded.x, expanded.y, expanded.width, expanded.height);
  }

  /**
   * アノテーション統計を取得
   */
  static getStatistics(annotations: Annotation[]): {
    total: number;
    byType: Record<string, number>;
    byColor: Record<string, number>;
    byPage: Record<number, number>;
  } {
    const stats = {
      total: annotations.length,
      byType: {} as Record<string, number>,
      byColor: {} as Record<string, number>,
      byPage: {} as Record<number, number>,
    };

    annotations.forEach((a) => {
      // Type count
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;

      // Color count
      stats.byColor[a.color] = (stats.byColor[a.color] || 0) + 1;

      // Page count
      stats.byPage[a.pageNumber] = (stats.byPage[a.pageNumber] || 0) + 1;
    });

    return stats;
  }
}

/**
 * グローバルインスタンス
 */
export const annotationDrawingManager = new AnnotationDrawingManager();

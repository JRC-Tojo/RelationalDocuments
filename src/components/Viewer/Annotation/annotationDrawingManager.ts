/**
 * アノテーション描画マネージャーサービス
 * アノテーション作成・編集イベントの管理
 */

import { v4 as uuidv4 } from 'uuid';
import type { Annotation, AnnotationType } from 'src/models/schemas';

export class AnnotationDrawingManager {
  private drawingType: AnnotationType = 'highlight';
  private color: string = '#FFD700';
  private pageNumber: number = 1;
  private documentId: string = '';
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private onAnnotationCreated: ((annotation: Annotation) => void) | null = null;

  /**
   * 描画開始
   */
  startDrawing(x: number, y: number) {
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;
  }

  /**
   * 描画中の座標を取得
   */
  getDrawingCoordinates(endX: number, endY: number) {
    if (!this.isDrawing) return null;

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;

    return {
      startX: this.startX,
      startY: this.startY,
      endX,
      endY,
      deltaX,
      deltaY,
    };
  }

  /**
   * 描画終了
   */
  endDrawing(endX: number, endY: number): Annotation | null {
    if (!this.isDrawing) return null;

    this.isDrawing = false;
    const annotation = this.createAnnotation(endX, endY);
    if (annotation && this.onAnnotationCreated) {
      this.onAnnotationCreated(annotation);
    }
    return annotation;
  }

  /**
   * アノテーションを作成
   */
  private createAnnotation(endX: number, endY: number): Annotation | null {
    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;

    const baseAnnotation: Annotation = {
      id: uuidv4(),
      documentId: this.documentId,
      pageNumber: this.pageNumber,
      type: this.drawingType,
      x: Math.min(this.startX, endX),
      y: Math.min(this.startY, endY),
      color: this.color,
      strokeWidth: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.drawingType === 'highlight' || this.drawingType === 'box') {
      return {
        ...baseAnnotation,
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        opacity: this.drawingType === 'highlight' ? 0.3 : 1,
      };
    } else if (this.drawingType === 'circle') {
      const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
      return {
        ...baseAnnotation,
        x: this.startX + deltaX / 2,
        y: this.startY + deltaY / 2,
        radius,
      };
    } else if (this.drawingType === 'line') {
      return {
        ...baseAnnotation,
        x2: endX,
        y2: endY,
        points: [0, 0, deltaX, deltaY],
      };
    }

    return null;
  }

  /**
   * 描画タイプを設定
   */
  setDrawingType(type: AnnotationType) {
    this.drawingType = type;
  }

  /**
   * 色を設定
   */
  setColor(color: string) {
    this.color = color;
  }

  /**
   * ページ番号を設定
   */
  setPageNumber(pageNumber: number) {
    this.pageNumber = pageNumber;
  }

  /**
   * ドキュメントIDを設定
   */
  setDocumentId(documentId: string) {
    this.documentId = documentId;
  }

  /**
   * アノテーション作成コールバックを設定
   */
  setAnnotationCreatedCallback(callback: (annotation: Annotation) => void) {
    this.onAnnotationCreated = callback;
  }

  /**
   * 描画中状態を取得
   */
  getIsDrawing(): boolean {
    return this.isDrawing;
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.onAnnotationCreated = null;
  }
}

export const annotationDrawingManager = new AnnotationDrawingManager();

/**
 * アノテーション描画マネージャーサービス
 * アノテーション作成・編集イベントの管理
 */

import { v4 as uuidv4 } from 'uuid';
import type { Annotation, DocumentId } from 'src/models/schemas';
import dayjs from 'dayjs';
import type { AnnotationType } from 'src/models/docPage';

/**
 * アノテーションの描画開始時に呼び出す
 *
 * 終了時に呼び出すことで新規アノテーションオブジェクトを取得する関数を返す
 */
export function startDrawingAnnotation(
  documentId: DocumentId,
  pageNumber: number,
  startX: number,
  startY: number,
  drawingType: AnnotationType,
  color: string = '#FFD700',
) {
  return (endX: number, endY: number) =>
    endDrawingAnnotation(documentId, pageNumber, startX, startY, endX, endY, drawingType, color);
}

function endDrawingAnnotation(
  documentId: DocumentId,
  pageNumber: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  drawingType: AnnotationType,
  color: string = '#FFD700',
) {
  const newAnnotation = createAnnotation(
    documentId,
    pageNumber,
    startX,
    startY,
    endX,
    endY,
    drawingType,
    color,
  );
  return newAnnotation;
}

function createAnnotation(
  docId: DocumentId,
  pageNumber: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  drawingType: AnnotationType,
  color: string = '#FFD700',
): Annotation | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  const baseAnnotation = {
    id: uuidv4(),
    documentId: docId,
    pageNumber: pageNumber,
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    color: color,
    strokeWidth: 2,
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    linkedAnnotationIds: [],
    tags: [],
    relatedDocumentIds: [],
  };

  if (drawingType === 'box') {
    return {
      ...baseAnnotation,
      type: drawingType,
      width: Math.abs(deltaX),
      height: Math.abs(deltaY),
      opacity: 1,
    };
  } else if (drawingType === 'circle') {
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
    return {
      ...baseAnnotation,
      type: drawingType,
      x: startX + deltaX / 2,
      y: startY + deltaY / 2,
      radius,
    };
  } else if (drawingType === 'line') {
    return {
      ...baseAnnotation,
      type: drawingType,
      x: startX,
      y: startY,
      x2: endX,
      y2: endY,
      points: [0, 0, deltaX, deltaY],
    };
  }

  return null;
}

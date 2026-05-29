/**
 * アノテーション描画マネージャーサービス
 * アノテーション作成・編集イベントの管理
 */

import { v4 as uuidv4 } from 'uuid';
import type { Annotation, DocumentId } from 'src/models/schemas';
import dayjs from 'dayjs';
import type { AnnotationStyle } from 'src/models/docPage';

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
  annotationStyle: AnnotationStyle,
) {
  return (endX: number, endY: number) =>
    endDrawingAnnotation(documentId, pageNumber, startX, startY, endX, endY, annotationStyle);
}

function endDrawingAnnotation(
  documentId: DocumentId,
  pageNumber: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  annotationStyle: AnnotationStyle,
) {
  const newAnnotation = createAnnotation(
    documentId,
    pageNumber,
    startX,
    startY,
    endX,
    endY,
    annotationStyle,
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
  annotationStyle: AnnotationStyle,
): Annotation | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  const baseAnnotation = {
    id: uuidv4(),
    documentId: docId,
    pageNumber: pageNumber,
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    linkedAnnotationIds: [],
    tags: [],
    relatedDocumentIds: [],
  };

  if (annotationStyle.type === 'box') {
    return {
      ...baseAnnotation,
      type: annotationStyle.type,
      color: annotationStyle.strokeColor,
      strokeWidth: annotationStyle.strokeWidth,
      width: Math.abs(deltaX),
      height: Math.abs(deltaY),
      opacity: annotationStyle.fillOpacity,
    };
  } else if (annotationStyle.type === 'circle') {
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
    return {
      ...baseAnnotation,
      type: annotationStyle.type,
      color: annotationStyle.strokeColor,
      strokeWidth: annotationStyle.strokeWidth,
      x: startX + deltaX / 2,
      y: startY + deltaY / 2,
      radius,
    };
  } else if (annotationStyle.type === 'line') {
    return {
      ...baseAnnotation,
      type: annotationStyle.type,
      color: annotationStyle.strokeColor,
      strokeWidth: annotationStyle.strokeWidth,
      x: startX,
      y: startY,
      x2: endX,
      y2: endY,
      points: [0, 0, deltaX, deltaY],
    };
  }

  return null;
}

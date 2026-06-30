/**
 * アノテーション描画マネージャーサービス
 * アノテーション作成・編集イベントの管理
 */

import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { AnnotationID, ColorCode, type AnnotationStyle } from 'src/models/document/pdf';
import type { DrawingAnnotationStyle } from 'src/models/docPage';

/**
 * アノテーションの描画開始時に呼び出す
 *
 * 終了時に呼び出すことで新規アノテーションオブジェクトを取得する関数を返す
 */
export function startDrawingAnnotation(
  pageNumber: number,
  startX: number,
  startY: number,
  annotationStyle: DrawingAnnotationStyle,
) {
  return (endX: number, endY: number) =>
    endDrawingAnnotation(pageNumber, startX, startY, endX, endY, annotationStyle);
}

function endDrawingAnnotation(
  pageNumber: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  annotationStyle: DrawingAnnotationStyle,
) {
  const newAnnotation = createAnnotation(pageNumber, startX, startY, endX, endY, annotationStyle);
  return newAnnotation;
}

function createAnnotation(
  pageNumber: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  annotationStyle: DrawingAnnotationStyle,
): AnnotationStyle | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  const baseAnnotation = {
    id: AnnotationID.parse(uuidv4()),
    pageNumber: pageNumber,
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    comment: {},
  };

  const strokeColor = ColorCode.safeParse(annotationStyle.strokeColor);
  if (!strokeColor.success) return null

  if (annotationStyle.type === 'box') {
    return {
      ...baseAnnotation,
      type: annotationStyle.type,
      color: strokeColor.data,
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
      color: strokeColor.data,
      strokeWidth: annotationStyle.strokeWidth,
      x: startX + deltaX / 2,
      y: startY + deltaY / 2,
      radius,
    };
  } else if (annotationStyle.type === 'line') {
    return {
      ...baseAnnotation,
      type: annotationStyle.type,
      color: strokeColor.data,
      strokeWidth: annotationStyle.strokeWidth,
      x: startX,
      y: startY,
      points: [0, 0, deltaX, deltaY],
    };
  }

  return null;
}

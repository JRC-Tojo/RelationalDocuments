/**
 * コンテナルートに保存するファイルスキーマを定義
 */

import z from 'zod';
import { AnnotationContext, AnnotationID, AnnotationStyle } from '../document/pdf';
import { ContainerID } from '../container';
import { Relational } from './common';

/**
 * `.rd/annots/<<filePath(hash)>>.json`に保存するスキーマ
 *
 * 本体データは本システムで付与するAnnotationIDなどのメタ情報を保存できないため、本体とは別に保存する
 *
 * TODO: 本当は様々な種類のファイルの`annots`に対応する必要があるが、現状ではPDFのみをサポート
 */
export const CachedAnnotFile = z.object({
  filePath: z.string(),
  fileHash: z.hash('sha256'),
  annots: z
    .object({
      style: AnnotationStyle,
      context: AnnotationContext,
    })
    .array(),
});
export type CachedAnnotFile = z.infer<typeof CachedAnnotFile>;

/**
 * `.rd/relational.json`に保存するスキーマ
 *
 * 本システムで定義する関係性情報を保存する
 */
export const CachedRelationalFile = z.object({
  // 関係性を定義したアノテーションの位置のみ保存
  annotIDs: z
    .object({
      id: AnnotationID,
      cID: ContainerID,
      filePath: z.string(),
    })
    .array(),
  relationals: Relational.array(),
});
export type CachedRelationalFile = z.infer<typeof CachedRelationalFile>;

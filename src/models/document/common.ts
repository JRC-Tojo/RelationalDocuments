import z from 'zod';
import { ContainerElementFile } from '../container';
import { Annotation } from './pdf';

/**
 * 文書の本体データ
 */
export const DocumentSource = z.base64().brand('DocumnetSource');
export type DocumentSource = z.infer<typeof DocumentSource>;

export const Document = z.discriminatedUnion('mimeType', [
  ContainerElementFile.extend({
    mimeType: z.literal('pdf'),
    src64: DocumentSource,
    annot: Annotation.array().optional().default([]),
  }),
  ContainerElementFile.extend({
    mimeType: z.literal('txt'),
    src64: DocumentSource,
  }),
])
export type Document = z.infer<typeof Document>;

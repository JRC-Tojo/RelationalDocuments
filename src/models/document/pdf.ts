import z from 'zod';

/**
 * アノテーションスキーマ
 */
const AnnotationBase = z.object({
  pageNumber: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  color: z.string(), // 16進カラーコード
  strokeWidth: z.number().optional().default(2),
  opacity: z.number().min(0).max(1).optional(),
  content: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  // relational: ???
});

export const Annotation = z.discriminatedUnion('type', [
  AnnotationBase.extend({
    type: z.literal('box'),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  AnnotationBase.extend({
    type: z.literal('circle'),
    radius: z.number().positive(),
  }),
  AnnotationBase.extend({
    type: z.literal('line'),
    x2: z.number(),
    y2: z.number(),
    points: z.array(z.number()).length(4),
  }),
]);
export type Annotation = z.infer<typeof Annotation>;

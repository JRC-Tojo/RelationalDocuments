import z from 'zod';

/**
 * 文書の本体データ
 */
export const DocumentSource = z.base64().brand('DocumnetSource');
export type DocumentSource = z.infer<typeof DocumentSource>;

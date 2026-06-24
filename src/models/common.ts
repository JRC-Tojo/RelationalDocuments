import z from "zod";

/**
 * 画像データをURI表記したデータ
 */
export const ImageURI = z.string().brand('ImageURI')
export type ImageURI = z.infer<typeof ImageURI>

import { createWorker } from "tesseract.js"


/**
 * 画像のURLを与えてその中の文字列を返す
 *
 * URLはimage/jpegのような形式を含む
 */
export async function Image2Text(imageUrl: string) {
  return ocrCore(imageUrl)
}

/**
 * OCRの本体
 */
async function ocrCore(imageUrl: string): Promise<string> {
  const worker = await createWorker("jpn")
  const converted = await worker.recognize(imageUrl)
  return converted.data.text
}


import { describe, expect, test } from 'bun:test';
import { Image2Text } from '../ocrRepository';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OCRASSESTS_DIR = join(import.meta.dir, 'ocrAssets');

/**
 * ocrAssetsフォルダから画像ファイルを読み込んでOCR結果を検証するテスト
 * 画像ファイルと対応する期待テキストファイル（.txt）が必要
 * 例：image.png と image.txt
 */
describe('ocr tests', () => {
  // ocrAssetsフォルダから画像ファイルを取得
  const files = readdirSync(OCRASSESTS_DIR);
  const imageFiles = files.filter(
    (file) => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'),
  );

  // テスト対象の画像ファイルがない場合はスキップ
  if (imageFiles.length === 0) {
    console.warn('No image files found in ocrAssets folder. Please add test images.');
    return;
  }

  // 各画像ファイルについてOCRを実行し、期待値と比較
  test.each(imageFiles)('simple images to ocr (%s)', async (imageFile) => {
    const imagePath = join(OCRASSESTS_DIR, imageFile);
    const expectedTextPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.txt');

    // 期待テキストファイルが存在するか確認
    let expectedText: string | null = null;
    try {
      expectedText = readFileSync(expectedTextPath, 'utf-8').trim();
    } catch {
      console.warn(`Expected text file not found for ${imageFile}. Skipping...`);
      return;
    }

    // OCRを実行
    const ocrResult = await Image2Text(imagePath);
    const normalizedOcrResult = ocrResult.trim();

    // 結果を比較
    expect(normalizedOcrResult).toBe(expectedText);
  });
});

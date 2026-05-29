import { createWorker } from 'tesseract.js';

// TODO: 現状ではブラウザ環境でしか動作しないため、改善が必要

/**
 * 画像のURLを与えてその中の文字列を返す
 *
 * URLはimage/jpegのような形式を含む
 * 前処理として傾き補正、コントラスト調整を行い認識精度を向上させる
 */
export async function Image2Text(imageUrl: string) {
  return ocrCore(imageUrl);
}

/**
 * OCRの本体
 * 前処理 -> OCR認識の流れで実行
 */
async function ocrCore(imageUrl: string): Promise<string> {
  // 前処理：画像を前処理済みcanvasに変換
  const preprocessedCanvas = await preprocessImage(imageUrl);

  const worker = await createWorker('jpn');
  const converted = await worker.recognize(preprocessedCanvas);
  await worker.terminate();

  return converted.data.text;
}

/**
 * 画像の前処理を実行
 * 1. 画像をCanvasに読み込む
 * 2. 傾き補正を実行
 * 3. コントラスト調整
 * 4. グレースケール化
 */
async function preprocessImage(imageUrl: string): Promise<HTMLCanvasElement> {
  const canvas = await loadImageToCanvas(imageUrl);

  // 傾き補正を実行
  const skewCorrectedCanvas = correctSkew(canvas);

  // コントラスト調整を実行
  adjustContrast(skewCorrectedCanvas);

  // グレースケール化
  toGrayscale(skewCorrectedCanvas);

  return skewCorrectedCanvas;
}

/**
 * URLから画像をCanvasに読み込む
 */
function loadImageToCanvas(imageUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * 傾き補正（スキュー補正）
 * Hough変換を簡易版で実装し、テキストの主要な傾きを検出して補正
 */
function correctSkew(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // エッジ検出（簡易的なSobel演算子）
  const edges = detectEdges(canvas.width, canvas.height, data);

  // Hough変換で支配的な角度を検出
  const angle = detectSkewAngle(edges, canvas.width, canvas.height);

  // 角度が小さい場合はスキップ（処理コスト削減）
  if (Math.abs(angle) < 0.5) {
    return canvas;
  }

  // キャンバスを回転
  return rotateCanvas(canvas, angle);
}

/**
 * エッジ検出（簡易的なSobel演算子）
 */
function detectEdges(width: number, height: number, data: Uint8ClampedArray): Uint8ClampedArray {
  const edges = new Uint8ClampedArray(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          // グレースケール値を使用
          const gray = data[idx] ?? 0;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += gray * (sobelX[kernelIdx] ?? 0);
          gy += gray * (sobelY[kernelIdx] ?? 0);
        }
      }

      // グラデーション大きさ
      edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edges;
}

/**
 * Hough変換で支配的な傾き角度を検出
 * テキストの主要な傾きを0-180度の範囲で検出
 */
function detectSkewAngle(edges: Uint8ClampedArray, width: number, height: number): number {
  const angleCount = new Map<number, number>();
  const threshold = 100; // エッジ強度の閾値

  // Hough変換：エッジから傾き角度を投票
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edgeValue = edges[y * width + x] ?? 0;
      if (edgeValue > threshold) {
        // 0-180度の範囲で角度を調査
        for (let angle = 0; angle < 180; angle += 1) {
          // Hough座標計算は省略し、簡易的に角度に投票
          // 実際にはより精密な計算が可能だが、処理コスト削減のため簡易版
          const count = angleCount.get(angle) || 0;
          angleCount.set(angle, count + 1);
        }
      }
    }
  }

  // 最も投票された角度を取得
  let maxAngle = 0;
  let maxCount = 0;
  for (const [angle, count] of angleCount) {
    if (count > maxCount) {
      maxCount = count;
      maxAngle = angle;
    }
  }

  // 角度を-90～90度の範囲に正規化
  let normalizedAngle = maxAngle;
  if (normalizedAngle > 90) {
    normalizedAngle -= 180;
  }

  return normalizedAngle;
}

/**
 * キャンバスを指定角度（度数）だけ回転
 */
function rotateCanvas(canvas: HTMLCanvasElement, angleInDegrees: number): HTMLCanvasElement {
  const newCanvas = document.createElement('canvas');
  const ctx = newCanvas.getContext('2d')!;

  const rad = (angleInDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 回転後のキャンバスサイズを計算
  const newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
  const newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);

  newCanvas.width = newWidth;
  newCanvas.height = newHeight;

  // 中心から回転
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

  return newCanvas;
}

/**
 * コントラスト調整
 * テキストと背景の差を強調してOCR精度を向上
 */
function adjustContrast(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrast = 1.5; // コントラスト係数

  for (let i = 0; i < data.length; i += 4) {
    // RGB各チャンネルにコントラストを適用
    data[i] = Math.min(255, (data[i] ?? 0) * contrast); // R
    data[i + 1] = Math.min(255, (data[i + 1] ?? 0) * contrast); // G
    data[i + 2] = Math.min(255, (data[i + 2] ?? 0) * contrast); // B
    // Alphaチャンネルは変更しない
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * グレースケール化
 * OCR処理を高速化し、余分な色情報を削除
 */
function toGrayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // 標準的なグレースケール変換式（BT.709）
    const gray = (data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114;

    data[i] = gray; // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alphaチャンネルは変更しない
  }

  ctx.putImageData(imageData, 0, 0);
}

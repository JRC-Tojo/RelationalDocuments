import Tesseract, { PSM } from 'tesseract.js';
import type { Canvas, CanvasRenderingContext2D } from 'canvas';
import { createCanvas, Image } from 'canvas';
import fs from 'fs';

// パイプライン実行用ヘルパー
const pipe = (
  ctx: CanvasRenderingContext2D,
  ...fns: Array<(ctx: CanvasRenderingContext2D) => void>
) => {
  fns.forEach((fn) => fn(ctx));
};

export async function Image2Text(imageUrl: string): Promise<string> {
  const canvas = await imageUrlToCanvas(imageUrl);
  return runOCR(canvas);
}

// 画像URLをCanvas型に変換する
const imageUrlToCanvas = async (imageUrl: string): Promise<Canvas> => {
  return new Promise((resolve, reject) => {
    // 1. fsでファイルの中身をBufferとして読み込む
    // ここでエラーが出れば、それは本当にパスの問題です
    const buffer = fs.readFileSync(imageUrl);

    // 2. Imageオブジェクトを生成
    const img = new Image();

    // 3. ロード完了後の処理
    img.onload = () => {
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };

    // 4. エラーハンドリング
    img.onerror = (err) => {
      reject(err);
    };

    // 5. Bufferをsrcにセット
    img.src = buffer;
  });
};

export const runOCR = async (canvas: Canvas): Promise<string> => {
  const ctx = canvas.getContext('2d');

  // 前処理のパイプライン実行
  pipe(
    ctx,
    grayscale,
    (c) => binarize(c, 128),
    deskew,
    (c) => autocrop(c, 10),
  );

  // OCRエンジンへ渡す
  const worker = await Tesseract.createWorker('jpn');
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });

  const {
    data: { text },
  } = await worker.recognize(canvas.toDataURL());
  await worker.terminate();

  // 前処理済みの画像を見るときに使用する
  // const filePath = __dirname + '/processed.png'
  // const buffer = canvas.toBuffer('image/png');
  // fs.writeFileSync(filePath, buffer);

  return text.replace(/\s+/g, "");;
};

// 1. グレースケール化
export const grayscale = (ctx: CanvasRenderingContext2D) => {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = avg;
  }
  ctx.putImageData(imageData, 0, 0);
};

// 2. 二値化
export const binarize = (ctx: CanvasRenderingContext2D, threshold: number = 128) => {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);
};

// 3. 傾き補正 (モーメント法で角度を算出し、Canvasを回転)
export const deskew = (ctx: CanvasRenderingContext2D) => {
  const { width: oldW, height: oldH } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, oldW, oldH);
  const data = imageData.data;

  // --- 1. モーメント法による角度算出 (ここは変更なし) ---
  let m00 = 0, m10 = 0, m01 = 0, m11 = 0, m20 = 0, m02 = 0;
  for (let y = 0; y < oldH; y++) {
    for (let x = 0; x < oldW; x++) {
      if (data[(y * oldW + x) * 4] < 128) { // 黒いピクセル
        m00 += 1; m10 += x; m01 += y;
        m11 += x * y; m20 += x * x; m02 += y * y;
      }
    }
  }
  if (m00 === 0) return;
  const angle = 0.5 * Math.atan2(2 * ((m11 / m00) - (m10 / m00) * (m01 / m00)), (m20 / m00) - (m02 / m00));

  // 角度がほぼ0なら何もしない
  if (Math.abs(angle) < 0.001) return;

  // --- 2. 回転後の新しいCanvasサイズを計算 ---
  const absCos = Math.abs(Math.cos(angle));
  const absSin = Math.abs(Math.sin(angle));

  // 回転後のBounding Boxサイズ
  const newW = oldW * absCos + oldH * absSin;
  const newH = oldW * absSin + oldH * absCos;

  // 一時的なCanvasを作成 (サイズは新サイズ)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newW;
  tempCanvas.height = newH;
  const tCtx = tempCanvas.getContext('2d')!;

  // 背景を透明にする場合（OCRに影響が出るなら白でfillRectする）
  // tCtx.fillStyle = 'white'; // 必要に応じて背景を白にする
  // tCtx.fillRect(0, 0, newW, newH);

  // --- 3. 【描画処理】新しい中心点で回転して描画 ---
  tCtx.save();
  // 3-1. 新しいキャンバスの中心へ移動
  tCtx.translate(newW / 2, newH / 2);
  // 3-2. 回転
  tCtx.rotate(angle);
  // 3-3. 元の画像の中心が原点になるようにオフセットして描画
  tCtx.drawImage(ctx.canvas, -oldW / 2, -oldH / 2);
  tCtx.restore();

  // --- 4. 元のCanvasへ書き戻し ---
  // 元のCanvasのサイズも新サイズに変更
  ctx.canvas.width = newW;
  ctx.canvas.height = newH;
  // サイズ変更でクリアされるため clearRect は不要
  ctx.drawImage(tempCanvas, 0, 0);
};

// 4. 自動トリミング
export const autocrop = (ctx: CanvasRenderingContext2D, padding: number = 5) => {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;

  // 1. コンテンツのバウンディングボックスを走査
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 2. 座標をキャンバスの範囲内にクランプ（制限）
  const startX = Math.max(0, minX - padding);
  const startY = Math.max(0, minY - padding);
  const endX = Math.min(width, maxX + padding);
  const endY = Math.min(height, maxY + padding);

  const w = endX - startX;
  const h = endY - startY;

  // 3. 正しい範囲でデータを取得してキャンバスを再設定
  const cropped = ctx.getImageData(startX, startY, w, h);

  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.putImageData(cropped, 0, 0);
};


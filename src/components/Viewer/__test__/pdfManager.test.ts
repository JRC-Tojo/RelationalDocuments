/**
 * pdfManager.ts の単体テスト
 *
 * `getPageViewportSizes`が「ページ数分を直列に待つ」実装から「一定並列数まで同時実行する」
 * 実装へ変わったことを検証する（大判文書を開く際の体感速度改善、Issue #109の任意項目対応）。
 * 実際のpdf.js/Canvasには依存せず、`getPage`/`getViewport`の最小限の形だけを満たす
 * フェイクのPDFDocumentProxyを与えてテストする。
 *
 * `pdfjs-dist`本体はモジュール評価時点で`new DOMMatrix()`を実行するため、DOMの無いbunテスト
 * 環境ではimportするだけで`ReferenceError: DOMMatrix is not defined`になる。
 * `mock.module('pdfjs-dist', ...)`で丸ごと差し替える方法は、同じパスを別の形でモック化している
 * 他のテストファイル（`repositories/document/__test__/pdf.test.ts`等）と競合し、bunの
 * `mock.module`がテストファイルをまたいで漏れる既知の問題（プロジェクトの記憶に記録済み）により
 * 実行順序次第でどちらかが壊れる。そのため、ここでは実体を差し替えず、`DOMMatrix`の
 * 最小限のグローバルスタブだけを用意して本物の`pdfjs-dist`/`pdfManager.ts`をそのまま読み込む
 * （`pdf.test.ts`が「フォールバック」として同種のスタブを既に使っている手法と同じ）
 */
import { describe, expect, it } from 'bun:test';

if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = class {};
}

const { getPageViewportSizes } = await import('../pdfManager');
type PdfDocument = Parameters<typeof getPageViewportSizes>[0];

/**
 * `getPageViewportSizes`が要求する最小限のインターフェースだけを満たすフェイクの
 * PDFDocumentProxyを作る。各ページの`getPage`呼び出しは`delayMs`だけ非同期で遅延させ、
 * 呼び出し中は`onCallStart`/`onCallEnd`で同時実行数を追跡できるようにする
 */
function createFakePdfDocument(
  numPages: number,
  delayMs: number,
  hooks: { onCallStart: () => void; onCallEnd: () => void },
): PdfDocument {
  return {
    numPages,
    getPage: async (pageNumber: number) => {
      hooks.onCallStart();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      hooks.onCallEnd();
      return {
        // pageNumberをそのまま幅・高さに反映し、戻り値の並び順検証に使う
        getViewport: () => ({ width: pageNumber * 10, height: pageNumber * 20 }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- テスト用フェイクのため最小限の形のみ満たす
  } as any;
}

describe('getPageViewportSizes', () => {
  it('全ページ分のサイズを、ページ番号順どおりに取得する', async () => {
    const pdf = createFakePdfDocument(5, 0, { onCallStart: () => {}, onCallEnd: () => {} });

    const sizes = await getPageViewportSizes(pdf);

    expect(sizes).toEqual([
      { width: 10, height: 20 },
      { width: 20, height: 40 },
      { width: 30, height: 60 },
      { width: 40, height: 80 },
      { width: 50, height: 100 },
    ]);
  });

  it('ページ数が多い場合、getPage呼び出しを直列ではなく並列に発行する（体感速度改善の要）', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const pdf = createFakePdfDocument(20, 5, {
      onCallStart: () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
      },
      onCallEnd: () => {
        inFlight--;
      },
    });

    await getPageViewportSizes(pdf);

    // 直列実装なら常に1、並列化されていれば複数のgetPage呼び出しが同時に進行するはず
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('並列数はWorkerを専有しすぎないよう上限（8）以内に収まる', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const pdf = createFakePdfDocument(50, 5, {
      onCallStart: () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
      },
      onCallEnd: () => {
        inFlight--;
      },
    });

    await getPageViewportSizes(pdf);

    expect(maxInFlight).toBeLessThanOrEqual(8);
  });

  it('ページ数が0件でも空配列を返す', async () => {
    const pdf = createFakePdfDocument(0, 0, { onCallStart: () => {}, onCallEnd: () => {} });
    expect(await getPageViewportSizes(pdf)).toEqual([]);
  });
});

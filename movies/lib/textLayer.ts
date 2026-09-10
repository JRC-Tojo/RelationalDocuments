/**
 * PDFビューアの透明テキストレイヤー（`.text-layer__item`, src/components/Viewer/TextLayer.vue）から
 * 実際の文字列の画面上の座標を取得するヘルパー。
 *
 * アノテーション自体はKonva/Canvas描画でDOM要素を持たないため、座標ベースでマウス操作するしかない。
 * このヘルパーを使うことで「計算書の541.39という数値の位置」のような、PDFの実内容に基づいた
 * 正確な座標をハードコードせずに求められる。
 *
 * 【重要な制約】これはPDFに埋め込みテキスト（pdf.jsの`getTextContent()`で取得できる文字情報）が
 * ある場合にしか使えない。CAD・計算ソフト由来のPDFはアウトライン化されていて埋め込みテキストを
 * 一切持たないことがあり得る。対象PDFに本当にテキストがあるか事前に確認すること
 * （`pdfjs-dist/legacy/build/pdf.mjs`の`page.getTextContent()`で直接検証できる）。無ければ、
 * 実際にスクリーンショットを撮った上で目視の座標をハードコードする方式に切り替える
 * （`scenarios/06-relationalLink.ts`の一般図.pdf側がこのケース）。
 *
 * また、OCRで後付けした文字レイヤーは「82.00」が「82. 00」のように余分な空白を含むなど、
 * 表記が揺れることがある。`findAllTextRects`は比較時に空白を無視して吸収する
 */
import type { Page } from '@playwright/test';
import { sleep } from './waits';

export interface TextRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * 現在DOMに存在する`.text-layer__item`の中から、指定文字列と完全一致する要素の矩形を
 * 画面上の縦位置（y）が小さい順（＝ページ上で上にあるものから順）に全て返す。
 * PDFのテキストアイテムはDOM出現順が必ずしも視覚上の並び順と一致しないため、
 * 「表の中の値」と「その下の数式の中の値」を区別する際はこの並び順を使うこと
 */
export async function findAllTextRects(page: Page, text: string): Promise<TextRect[]> {
  const boxes = await page.evaluate(
    ({ text }) => {
      const normalize = (s: string) => s.replace(/\s+/g, '');
      const target = normalize(text);
      const items = Array.from(document.querySelectorAll<HTMLElement>('.text-layer__item')).filter(
        (el) => normalize(el.textContent ?? '') === target,
      );
      return items.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    },
    { text },
  );
  return boxes
    .map((box) => ({ ...box, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2 }))
    .sort((a, b) => a.y - b.y);
}

/** 現在DOMに存在する`.text-layer__item`の中から、指定文字列と完全一致する要素の矩形を返す（見つからなければnull） */
export async function findTextRect(
  page: Page,
  text: string,
  occurrence = 0,
): Promise<TextRect | null> {
  const all = await findAllTextRects(page, text);
  return all[occurrence] ?? null;
}

/**
 * 部分一致版。図面のように、文字間隔や表記ゆれ（全角/半角の記号違いなど）で完全一致が
 * 期待しづらい箇所を探すのに使う。y座標が小さい順（ページ上で上にあるものから順）に返す
 */
export async function findAllTextRectsContaining(
  page: Page,
  substring: string,
): Promise<TextRect[]> {
  const boxes = await page.evaluate(
    ({ substring }) => {
      const items = Array.from(document.querySelectorAll<HTMLElement>('.text-layer__item')).filter(
        (el) => el.textContent?.includes(substring),
      );
      return items.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    },
    { substring },
  );
  return boxes
    .map((box) => ({ ...box, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2 }))
    .sort((a, b) => a.y - b.y);
}

/**
 * 指定文字列が見つかるまで、ビューア領域上でマウスホイールスクロールを繰り返す。
 * 無限ループを避けるため試行回数に上限を設け、見つからなければ例外を投げる
 * （ネイティブダイアログ同様「見つからないまま延々粘る」ことを避ける方針）。
 */
export async function scrollUntilTextFound(
  page: Page,
  text: string,
  scrollAnchor: { x: number; y: number },
  opts: { occurrence?: number; maxAttempts?: number; scrollStep?: number; direction?: 1 | -1 } = {},
): Promise<TextRect> {
  const { occurrence = 0, maxAttempts = 40, scrollStep = 320, direction = 1 } = opts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rect = await findTextRect(page, text, occurrence);
    if (rect) {
      const viewportH = await page.evaluate(() => window.innerHeight);
      const viewportW = await page.evaluate(() => window.innerWidth);
      const margin = 24;
      const inView =
        rect.y >= margin &&
        rect.x >= margin &&
        rect.y + rect.height <= viewportH - margin &&
        rect.x + rect.width <= viewportW - margin;
      if (inView) return rect;
    }
    await page.mouse.move(scrollAnchor.x, scrollAnchor.y);
    await page.mouse.wheel(0, scrollStep * direction);
    await sleep(180);
  }

  throw new Error(
    `movies/lib/textLayer: テキスト「${text}」（${occurrence}番目）がスクロール${maxAttempts}回以内に見つかりませんでした`,
  );
}

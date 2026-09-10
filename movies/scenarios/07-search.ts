/**
 * シナリオ07: 検索機能の紹介（文書内検索 → コンテナ横断検索）
 *
 * 【検索語について】計算書.pdfの埋め込みテキストレイヤー（pdf.js `getTextContent()`）を
 * 実際に抽出して確認した結果、"350"（主桁断面のフランジ幅 mm。断面諸量の計算で繰り返し使われる）
 * という数値が計算書.pdf内に計10箇所（1ページ目に8箇所、2ページ目に2箇所）出現することを
 * 確認済み。以前使っていた"148.8"（2・3ページ目に2箇所ずつ、計4箇所）はマッチ数が少なく
 * 「たまたま見つかっただけ」に見えるというレビュー指摘を受け、より出現頻度が高く「確実に
 * 全件拾えている」ことが一目で分かる"350"に差し替えた。単一ページにしか出現しない"SM400"
 * （1ページ目のみ）の代わりにCtrl+F検索のデモではこちらを使い、「次を検索」で1ページ目の
 * 多数のマッチを辿ったのち2ページ目へまたぐ様子を見せる
 */
import { sleep } from '../lib/waits';
import { typeSlowly } from '../lib/slowType';
import type { Scenario } from './types';
import type { Locator, Page } from '@playwright/test';
import type { Director } from '../director/director';

/** 検索欄の周囲に余白を足した矩形を返す（ズーム時に入力欄だけがギリギリ画面いっぱいになるのを避ける） */
function padRect(
  rect: { x: number; y: number; width: number; height: number },
  pad: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/**
 * 入力欄付近を軽くズームしながら1文字ずつ入力する。ズーム中は実クリック座標がずれるため
 * （CSS transformによる見た目だけの拡大）、入力自体はキーボードのみで完結させ、
 * ズームを戻してから後続のクリック操作（Enter相当のキー操作を除く）へ進む
 */
async function typeSlowlyZoomed(
  ctx: { page: Page; director: Director },
  locator: Locator,
  text: string,
): Promise<void> {
  const { page, director } = ctx;
  const box = await locator.boundingBox();
  if (box) await director.zoomTo(padRect(box, 60), 1.4);
  await typeSlowly(page, locator, text);
  if (box) await director.zoomReset();
}

export const search: Scenario = {
  id: '07-search',
  async run(ctx) {
    const { page, director, mouse } = ctx;

    // --- 文書内検索（Ctrl+F） ---
    await director.caption('文書内を検索する', 'Ctrl + F で、開いている文書の中をその場で検索できます。');

    const calcTab = page.locator('.tab-item').filter({ hasText: '計算書' }).first();
    await mouse.clickLocator(calcTab);

    // Ctrl+Fのキャプチャは文書ビューア側で行われるため、タブ切り替えだけでなく
    // ビューア内を一度クリックしてキーボードフォーカスを確実に移しておく。
    // レビュー指摘を受けて修正：シナリオ02で一般図タブが右上（ur）ペインへ移動済みのため、
    // 1600x900ビューポートの右半分（x>800）は一般図側になっている。x=970は誤って
    // 一般図ペイン内をクリックしてしまい、以降の検索が計算書ではなく一般図に対して実行される
    // 不具合の原因だった。左ペイン（計算書=ul）の文書内容の上に確実に収まるx=400へ修正する
    // （06-relationalLink.tsのCALC_SPEC_RECT付近、x:589-778がul内の実測値であることからも
    // x=400が左ペイン内であることを確認済み）
    await mouse.click(400, 550);
    await sleep(200);

    await director.shortcut('Ctrl + F');
    await page.keyboard.press('Control+f');

    const searchBar = page.locator('.search-bar').first();
    await searchBar.waitFor({ state: 'visible', timeout: 5000 });
    const searchInput = page.locator('.search-bar__input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // "350"は主桁断面のフランジ幅の数値で、計算書.pdf内に計10箇所（1ページ目8箇所・2ページ目2箇所）
    // 登場する（ファイル冒頭のコメント参照）。1文字ずつゆっくり入力し、検索欄付近を軽くズームして
    // 「実際に入力している」ことが動画から分かるようにする
    await typeSlowlyZoomed(ctx, searchInput, '350');

    // デバウンス（アプリ側300ms）を待ってから、最初のマッチへ自動ジャンプするのを見せる
    await sleep(900);
    await director.settle();

    // --- 多数のマッチを「次を検索」で辿り、ページをまたぐ様子も見せる ---
    await director.caption(
      '多くのマッチを確実に辿る',
      '「次を検索」ボタンで、1ページ目に集中する多数のマッチを順に確認し、2ページ目まで確実にたどり着けます。',
    );

    const nextMatchButton = searchBar.locator('.q-icon:text-is("keyboard_arrow_down")').first();
    // 自動ジャンプで1ページ目の1箇所目を表示済みのため、1〜7回目のクリックで1ページ目の
    // 残り7箇所（計8箇所）を辿り、8回目のクリックで2ページ目の1箇所目へまたぐ。
    // 9回目で2ページ目の2箇所目（計算書.pdf内の最後のマッチ）まで表示し、
    // 「多数のマッチを取りこぼさず、ページをまたいでも辿れる」ことを見せ切る
    for (let i = 0; i < 9; i++) {
      await mouse.clickLocator(nextMatchButton);
      await sleep(800);
    }
    await director.settle();

    await page.keyboard.press('Escape');
    await sleep(300);

    // --- コンテナ横断検索 ---
    await director.caption(
      'コンテナをまたいで検索する',
      'キーワード1つで、コンテナ内の全PDFを横断的に検索できます。',
    );

    const searchRailTab = page.locator('.rail-tabs .q-tab').nth(1);
    await mouse.clickLocator(searchRailTab);

    const input = page.locator('.q-tab-panel:visible input').first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await typeSlowlyZoomed(ctx, input, 'SM400');
    await page.keyboard.press('Enter');

    await page.locator('.search-view-match-item').first().waitFor({ state: 'visible', timeout: 8000 });
    await sleep(800);
    await director.settle();

    // --- 結果クリックでヒット箇所がハイライトされることを見せる ---
    await director.caption(
      '検索結果からヒット箇所へジャンプ',
      '結果をクリックすると、その文書を開いた上でヒット箇所がハイライト表示されます。',
    );
    await mouse.clickLocator(page.locator('.search-view-match-item').first());

    // ハイライト矩形はタブが開いてPDFが描画された後に非同期でDOMへ現れるため、少し待ってから探す
    const activeHighlight = page.locator('.search-highlight-layer__box--active').first();
    await activeHighlight.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const highlightBox = await activeHighlight.boundingBox().catch(() => null);
    if (highlightBox) {
      await director.zoomTo(padRect(highlightBox, 80), 1.6);
      await sleep(1200);
      await director.zoomReset();
    } else {
      await sleep(500);
    }
    await director.settle();
  },
};

/**
 * シナリオ04: 計算書タブで各表示モードを紹介する（最終的に連続表示モードへ。以降の作業は全てこのモードで行う）
 */
import type { Page } from '@playwright/test';
import { sleep } from '../lib/waits';
import type { MovieContext, Scenario } from './types';

async function openViewModeMenu(ctx: MovieContext) {
  const { page, mouse } = ctx;
  await mouse.clickLocator(page.locator('[data-testid="view-mode-menu"]').first());
  await sleep(200);
}

/** そのモードが現在選択中であることを示す`q-btn--outline`クラスが付くまで待つ */
async function isModeActive(page: Page, label: string): Promise<boolean> {
  const option = page.locator('.toolbar-btn').filter({ hasText: label }).first();
  const cls = await option.getAttribute('class').catch(() => null);
  return cls?.includes('q-btn--outline') ?? false;
}

/**
 * 表示モードを選択する。クリック後にメニューを開き直して実際に切り替わったかを確認し、
 * 反映されていなければ最大2回まで再試行する（クリック直後の状態確認だけでは、
 * 描画の反映タイミングによって切り替わっていないことがあるため）
 */
async function selectViewMode(ctx: MovieContext, label: string): Promise<void> {
  const { page, mouse } = ctx;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const option = page.locator('.toolbar-btn').filter({ hasText: label }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await mouse.clickLocator(option);
    await sleep(500);

    await openViewModeMenu(ctx);
    const active = await isModeActive(page, label);
    // 確認のために開き直したメニューは、呼び出し元が次回`openViewModeMenu`で新規に開けるよう
    // ここで必ず閉じておく（開いたままだと次のクリックがトグルで閉じるだけになってしまう）
    await page.keyboard.press('Escape');
    await sleep(200);
    if (active) return;

    if (attempt === 3) {
      throw new Error(`movies/scenarios/04: 表示モード「${label}」への切り替えが反映されませんでした`);
    }
  }
}

export const viewModes: Scenario = {
  id: '04-viewModes',
  async run(ctx) {
    const { page, director, mouse } = ctx;

    // シナリオ02で図面タブを右上ペインへ移動した直後は、フォーカスがそちらに残っている
    // ことがあるため、表示モード変更の対象が計算書になるよう明示的にタブをクリックしておく
    const calcTab = page.locator('.tab-item').filter({ hasText: '計算書' }).first();
    await mouse.clickLocator(calcTab);

    await director.caption(
      '表示モードを切り替える',
      '単一ページ・連続表示・ページ一覧をワンクリックで切り替えられます。',
    );

    await openViewModeMenu(ctx);
    await selectViewMode(ctx, '単一ページ');

    await openViewModeMenu(ctx);
    await selectViewMode(ctx, 'ページ一覧');

    // 次のキャプションに切り替わったことが視聴者に伝わるよう、一旦明示的に消す
    await director.settle();

    await director.caption('連続表示モードで作業する', 'ここからは連続表示モードのまま進めます。');
    await openViewModeMenu(ctx);
    await selectViewMode(ctx, '連続表示');

    await director.settle();
  },
};

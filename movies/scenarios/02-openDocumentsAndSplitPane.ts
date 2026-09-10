/**
 * シナリオ02: 計算書と図面を開く→図面タブを右クリックして右上のペインに移動する
 *
 * 「文書を開く」キャプションは01の末尾（コンテナ展開直後）で既に表示済みのため、
 * ここでは出し直さずそのまま操作を始める（表示時間を稼ぐためのレビュー対応）
 */
import { hoverToOpenSubmenu, rightClickLocator } from '../lib/appActions';
import type { Scenario } from './types';

export const openDocumentsAndSplitPane: Scenario = {
  id: '02-openDocumentsAndSplitPane',
  async run({ page, director, mouse }) {
    const calcFile = page.locator('.exp-file').filter({ hasText: '計算書.pdf' }).first();
    await mouse.clickLocator(calcFile);
    await page
      .locator('.tab-item')
      .filter({ hasText: '計算書' })
      .first()
      .waitFor({ state: 'visible' });

    const drawingFile = page.locator('.exp-file').filter({ hasText: '一般図.pdf' }).first();
    await mouse.clickLocator(drawingFile);
    const drawingTab = page.locator('.tab-item').filter({ hasText: '一般図' }).first();
    await drawingTab.waitFor({ state: 'visible' });

    // 前段（01由来）のキャプションを明示的に消してから、次のキャプションへ切り替える
    await director.settle();

    await director.caption(
      'タブを別のペインへ',
      '右クリックで、開いたタブを好きなペインへ振り分けられます。',
    );
    await director.shortcut('右クリック');
    await rightClickLocator(page, mouse, drawingTab);

    // 「別のペインに移動」はクリックではなくホバー（400ms超）でのみサブメニューが開く
    // 実装（TabContextMenu.vue）のため、滑らかにマウスを乗せて留まりサブメニューを開かせる。
    // このホバー待ちの間もキャプションが表示され続けるので、表示時間を稼ぐ効果もある
    const submenu = await hoverToOpenSubmenu(page, mouse, '別のペインに移動');
    const upperRightItem = submenu.locator('.q-item').filter({ hasText: '右上のペイン' }).first();
    await mouse.clickLocator(upperRightItem);

    await page
      .locator('[layout-side="ur"], .doc-tabs-page')
      .filter({ hasText: '一般図' })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });

    await director.settle();
  },
};

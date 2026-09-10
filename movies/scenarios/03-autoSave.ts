/**
 * シナリオ03: 自動保存をONにする（ヘッダー常設のトグル）
 */
import { TIMING } from '../config';
import { sleep } from '../lib/waits';
import type { Scenario } from './types';

export const autoSave: Scenario = {
  id: '03-autoSave',
  async run({ page, director, mouse }) {
    await director.caption(
      '自動保存をON',
      '一度ONにしておけば、アノテーションの追加や関係性の登録がその都度自動で保存されます。',
    );

    const toggle = page.locator('.q-bar .q-toggle').first();

    // トグルは小さく見づらいため、強調ズームで拡大したままクリックする。
    // `mouse.clickLocator`はクリック直前にlocatorの`boundingBox()`を取り直しており、
    // これはCSS transformによる拡大後の実際の描画結果を反映するため、ズームしたままでも
    // 見た目通りの座標でクリックできる（スタンドアロンのPlaywright検証スクリプトで確認済み）
    const rect = await mouse.rectOf(toggle);
    const pad = rect.height * 2;
    await director.zoomTo({
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
    await sleep(TIMING.zoomHold);

    await mouse.clickLocator(toggle);
    await sleep(500);

    await director.zoomReset();
    await director.settle();
  },
};

/**
 * アプリ操作紹介動画の撮影本体。
 *
 * コンテナのデータ投入は開発ビルド限定の内部フック経由（`lib/seedContainer.ts`）で行うため、
 * OSネイティブダイアログへの権限付与やブラウザプロファイルの永続化は一切不要。
 * 毎回まっさらな状態（`browser.newContext`）で撮影する。
 *
 * 実行方法（Windows環境なのでNode.js経由。Bunではない）:
 *   npx playwright test -c movies/playwright.movies.config.ts movies/record.spec.ts
 */
import { chromium, test } from '@playwright/test';
import { OUTPUT_DIR, VIEWPORT } from './config';
import { Director } from './director/director';
import { SmoothMouse } from './lib/smoothMouse';
import { scenarios } from './scenarios';
import type { MovieContext } from './scenarios/types';

test('kumihimo 操作紹介動画', async () => {
  test.setTimeout(20 * 60 * 1000);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUTPUT_DIR, size: VIEWPORT },
  });

  try {
    const page = await context.newPage();
    const director = new Director(page);
    await director.install();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await director.cursorShow();

    const ctx: MovieContext = { page, director, mouse: new SmoothMouse(page) };

    for (const scenario of scenarios) {
      console.log(`▶ シナリオ開始: ${scenario.id}`);
      await scenario.run(ctx);
      console.log(`✔ シナリオ完了: ${scenario.id}`);
    }
  } finally {
    // 例外発生時もここまでの映像を確実に保存する（`close()`でファイルにフラッシュされる）
    await context.close();
    await browser.close();
  }
});

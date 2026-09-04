import { defineConfig, devices } from '@playwright/test';
import type { ModeFixtures } from './e2e/support/fixtures';

/**
 * 関係性・アノテーション操作・PDFレンダリングの「ビジュアル/操作感」E2Eテスト用設定。
 *
 * ロジック層は`bun test --isolate`で検証済みのため、ここでは実Chromium・実Electronでの
 * 実描画・実操作のみを対象とする（`bun run test:e2e`。既存の`bun run test`とは完全に分離）。
 * `chromium`（PWA相当）・`electron`（デスクトップアプリ相当）の2プロジェクトが同じspecファイル
 * （`e2e/specs/*.spec.ts`）をそれぞれ実行し、両モードで機能に差異がないことを検証する
 * （`electron`プロジェクトの`page`は`e2e/support/fixtures.ts`が実Electronウィンドウへ差し替える）。
 *
 * 注意: Windows環境ではBunランタイムでChromium/Electronを起動すると既知の不具合でハングするため
 * （`chromium.launch()`がタイムアウトする。oven-sh/bun#27977等）、`npx playwright test`
 * （Node.js）で実行すること。Linux/macOSでは再現しない
 */
export default defineConfig<ModeFixtures>({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 対象は`bun run dev`（Vite開発サーバー）1プロセスを`chromium`・`electron`両プロジェクトで
  // 共有する。workers>1で実行すると、同じ開発サーバー・同じマシン上でChromium/Electronの
  // 複数contextが同時にIndexedDBへアクセスし、"Internal error opening backing store for
  // indexedDB.open"のような資源競合エラーが実測で頻発した（chromiumプロジェクト単体でも同様に
  // 再現したため、Electron固有の問題ではなく複数ワーカーの並列実行そのものが原因）。そのため
  // 1プロセス内では常に直列実行する。`chromium`・`electron`を実際に並列実行したい場合は、
  // `npx playwright test --project=chromium`と`--project=electron`を、それぞれ独立した
  // 開発サーバーを持つ別プロセス（別CIジョブ等）として同時に起動すること
  // （`.github/workflows/frontend.yml`のe2eジョブはmatrix戦略でこれを行う）
  workers: 1,
  // 'list'はコンソール出力のみでplaywright-report/を生成しないため、CI失敗時にアップロードする
  // レポート（.github/workflows/frontend.ymlのUpload Playwright reportステップ）用にhtmlも併用する
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:9200',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], mode: 'chromium' },
    },
    {
      name: 'electron',
      use: { mode: 'electron' },
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:9200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

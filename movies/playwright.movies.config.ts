import { defineConfig, devices } from '@playwright/test';
import { VIEWPORT } from './config';

/**
 * アプリ操作紹介動画の撮影専用Playwright設定。
 *
 * 既存の`playwright.config.ts`（e2e/配下、CI連携済み）とは完全に分離し、
 * `movies/`配下の`*.spec.ts`のみを対象にする。動画の生成そのものが目的のため、
 * 失敗時に動画を残さない設定にはせず、常に録画する。
 *
 * 注意: 本プロジェクトの規約通り、Windows環境ではBunではなくNode.js経由で実行すること
 * （`npx playwright test -c movies/playwright.movies.config.ts`）。
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 20 * 60 * 1000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:9200',
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    video: { mode: 'on', size: VIEWPORT },
    trace: 'off',
    screenshot: 'off',
  },
  // 注意: Playwright設定内の相対パスは（Node実行時のcwdではなく）このconfigファイル自身の
  // ディレクトリ（movies/）基準で解決される。`config.ts`のOUTPUT_DIR（"movies/output"、
  // record.spec.ts側でcwd基準に使う値）をここでそのまま使うと"movies/movies/output"に
  // 二重解決されてしまうため、ここだけはmovies/相対のリテラルを使う
  outputDir: 'output/.playwright-artifacts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:9200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

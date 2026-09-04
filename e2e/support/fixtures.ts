import { test as base, expect, _electron } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `test`/`page`を差し替えるための追加フィクスチャ。
 *
 * `mode`はプロジェクト単位のオプション（`playwright.config.ts`の`projects[].use.mode`）として
 * 設定する。既存の5つのspecファイルはこのモジュールから`test`/`expect`を読み込むだけで、
 * PWA（実Chromiumタブ）・Electron（実Electronウィンドウ）の両方に対してそのまま実行できる
 */
export type ModeFixtures = { mode: 'chromium' | 'electron' };

export const test = base.extend<ModeFixtures>({
  mode: ['chromium', { option: true }],

  page: async ({ mode, page: browserPage, baseURL }, use) => {
    if (mode !== 'electron') {
      await use(browserPage);
      return;
    }

    // Electronプロジェクトでは、既定のブラウザ用page（chromiumタブ）は使わず、実Electron
    // ウィンドウを起動してそちらを`page`として扱う。既定のpageフィクスチャに依存しているため
    // 未使用のブラウザコンテキストが1つ余分に立ち上がる（許容しているオーバーヘッド。詳細は
    // このファイルの末尾コメント参照）
    const resolvedBaseURL = baseURL ?? 'http://localhost:9200';
    // process.envは値がstring|undefinedだが、_electron.launchのenvはRecord<string, string>を
    // 要求するため、undefinedのキーを除いてから渡す
    const definedEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => {
        const [, value] = entry;
        return value !== undefined;
      }),
    );
    const electronApp = await _electron.launch({
      args: [path.join(dirname, '../electron/testMain.cjs')],
      env: { ...definedEnv, E2E_APP_URL: resolvedBaseURL },
    });
    const window = await electronApp.firstWindow();

    // Electronウィンドウの`page`は、通常のブラウザcontextと異なり`use.baseURL`が適用されない
    // ため、`page.goto('/')`のような相対URLを解決できずエラーになる。既存specはbaseURL前提の
    // 相対gotoを使っているため、ここで`goto`を差し替えてbaseURLに対する解決を行う
    const originalGoto = window.goto.bind(window);
    window.goto = (url: string, options?: Parameters<Page['goto']>[1]) => {
      const resolvedUrl = /^[a-z]+:\/\//i.test(url)
        ? url
        : new URL(url, resolvedBaseURL).toString();
      return originalGoto(resolvedUrl, options);
    };

    await use(window);
    await electronApp.close();
  },
});

export { expect };

// 実装メモ: Playwrightのフィクスチャは関数シグネチャの分割代入パターンから静的に依存関係を
// 解決するため、`page`フィクスチャ内で`mode`により分岐していても、そのシグネチャが依存する
// 標準の`page`（＝`browser`/`context`）は`mode`に関わらず常にインスタンス化される。
// つまりElectronプロジェクトの実行時にも使われないChromiumのcontext/pageが1つ生成される。
// 完全に無駄をなくすには`page`フィクスチャをプロジェクトごとに完全に分離した`test`オブジェクトへ
// 分ける必要があるが、5つの既存specファイルをモード非依存のまま共有できる利点を優先し、
// 現時点ではこのオーバーヘッドを許容する

/**
 * ネイティブのフォルダ選択ダイアログを経由せず、実際の業務PDFを「cache」（インメモリ）型の
 * コンテナへ直接投入するヘルパー。
 *
 * kumihimoは開発ビルド限定で`window.__kumihimoTest.api`（実体は`useBackendApi()`そのもの）を
 * 公開しており（`src/boot/testHook.ts`）、e2eテスト（`e2e/support/seed.ts`）もこれを使って
 * テスト用コンテナを用意している。同じ経路で、実業務PDFのバイト列をそのままcacheコンテナに
 * 書き込むことで、「実際に使用するPDFを含むコンテナ」を用意しつつ、自動操作も録画もできない
 * OSネイティブダイアログを完全に回避する。
 *
 * 画面上は「＋→ローカルフォルダ→フォルダを選択」という本来の操作もあわせて見せた上で、
 * 実際のデータ投入だけをこの経路で行う（`scenarios/01-createContainer.ts`を参照）。
 */
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

/**
 * `src/boot/testHook.ts`（開発ビルド専用）が`window`へ生やすフックの、ここで使う分だけの最小型。
 * e2e/配下は独自の実行系のため型を共有しておらず、movies/も同様に自己完結させる
 */
interface KumihimoTestApiSubset {
  createContainer(
    type: 'cache',
    name: string,
    path: string,
  ): Promise<{ ok: boolean; data?: { id: string }; error?: unknown }>;
  loadContainer(id: string): Promise<{ ok: boolean; error?: unknown }>;
  saveFile(
    containerId: string,
    filePath: string,
    src64: string,
  ): Promise<{ ok: boolean; data?: unknown; error?: unknown }>;
}

/**
 * `window.__kumihimoTest`の型。`e2e/support/testHook.ts`側で既に`Window.__kumihimoTest`の
 * グローバル型を宣言しているため、ここで同名の`declare global`を重ねると型定義が衝突する
 * （vue-tscがプロジェクト全体を1つのプログラムとして見るため）。movies/はe2e/の型に依存したくないので、
 * `declare global`は使わず、ブラウザ側で実行するコールバックの中でその都度ローカルキャストする
 * （`page.evaluate`等のコールバックはtoString()で送られるため、Node側の共通関数には切り出せない）
 */
type WindowWithTestHook = Window & { __kumihimoTest?: { api: KumihimoTestApiSubset } };

export interface SeedFile {
  /** コンテナ内でのパス（フォルダ区切りを含んでよい。例: "計算書・図面/計算書.pdf"） */
  containerPath: string;
  /** 実ファイルの絶対パス（ここから実際のPDFバイト列を読み込む） */
  absolutePath: string;
}

/** `window.__kumihimoTest`が生えるまで待つ（開発ビルドのboot完了を待つ） */
async function waitForTestHook(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as WindowWithTestHook).__kumihimoTest !== undefined, undefined, {
    timeout: 15000,
  });
}

/**
 * cache型コンテナを1つ作成し、実PDFファイル群を書き込む。戻り値はコンテナID。
 * `ExplorerView.vue`はコンテナ一覧をマウント時にしか取得しないため、呼び出し側で
 * このあと`page.reload()`する必要がある（e2eの`seedCacheContainerWithFixturePdf`と同じ注意点）
 */
export async function seedRealContainer(
  page: Page,
  containerName: string,
  files: SeedFile[],
): Promise<string> {
  await waitForTestHook(page);

  const encoded = await Promise.all(
    files.map(async (f) => ({
      containerPath: f.containerPath,
      base64: (await readFile(f.absolutePath)).toString('base64'),
    })),
  );

  const containerId = await page.evaluate(
    async ({ containerName, encoded }) => {
      const api = (window as WindowWithTestHook).__kumihimoTest?.api;
      if (!api) throw new Error('__kumihimoTest hook is not available');

      const containerRes = await api.createContainer('cache', containerName, '/');
      if (!containerRes.ok || !containerRes.data) {
        throw new Error(`createContainer failed: ${JSON.stringify(containerRes.error)}`);
      }
      const id = containerRes.data.id;

      const loadRes = await api.loadContainer(id);
      if (!loadRes.ok) throw new Error(`loadContainer failed: ${JSON.stringify(loadRes.error)}`);

      for (const file of encoded) {
        const fileRes = await api.saveFile(id, file.containerPath, file.base64);
        if (!fileRes.ok) {
          throw new Error(`saveFile(${file.containerPath}) failed: ${JSON.stringify(fileRes.error)}`);
        }
      }

      return id;
    },
    { containerName, encoded },
  );

  return containerId;
}

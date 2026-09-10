/**
 * シナリオ01: コンテナ作成（実フォルダ「サンプルコンテナ」の中身を使う）
 *
 * 実際の業務では ＋ → 「ローカルフォルダ」タブ → 「フォルダを選択」でOSネイティブの
 * フォルダ選択ダイアログを開いて選ぶ。この操作自体は画面演出として実際にクリックして見せるが、
 * そのダイアログはPlaywrightで自動操作できず、録画にも一切映らない（ページ内描画しか
 * 記録されないため）。そのため実際のデータ投入は、開発ビルド限定の内部フック
 * （`window.__kumihimoTest.api`、実体は本物の`BackendApi`）経由で、実PDFのバイト列を
 * そのまま「cache」（インメモリ）型コンテナへ書き込む方式で行う（詳細は`lib/seedContainer.ts`）。
 * 表示されるフォルダ構成・PDFの中身は実物と同一で、映るのはKumihimoの画面だけという扱い。
 */
import path from 'node:path';
import { iconButton } from '../lib/appActions';
import { seedRealContainer } from '../lib/seedContainer';
import { sleep } from '../lib/waits';
import { SAMPLE_CONTAINER_PATH, SAMPLE_FILES } from '../config';
import type { Scenario } from './types';

export const createContainer: Scenario = {
  id: '01-createContainer',
  async run({ page, director, mouse }) {
    await director.caption(
      'コンテナを作成',
      '業務フォルダをそのまま「コンテナ」として取り込みます。\nPDFの中身もフォルダ構成もそのままです。',
    );

    // --- ここから「画面演出」: 実際の操作手順（＋→ローカルフォルダ→フォルダを選択）を見せる ---
    const addButton = iconButton(page, 'add', page.locator('.explorer-view, [class*="explorer"]').first());
    await mouse.clickLocator(addButton);

    const dialog = page.locator('.q-dialog').first();
    await dialog.waitFor({ state: 'visible' });

    await director.shortcut('フォルダを選択');
    const pickButton = dialog.getByText('フォルダを選択', { exact: true }).first();
    await mouse.clickLocator(pickButton);
    await sleep(400);

    const closeButton = dialog.getByText('閉じる', { exact: true }).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await mouse.clickLocator(closeButton);
    } else {
      await page.keyboard.press('Escape');
    }
    // --- 画面演出ここまで。以降は実データを裏側からcacheコンテナに投入する ---

    const containerName = 'サンプルコンテナ';
    await seedRealContainer(page, containerName, [
      {
        containerPath: SAMPLE_FILES.calculationSheet.containerPath,
        absolutePath: path.join(SAMPLE_CONTAINER_PATH, SAMPLE_FILES.calculationSheet.diskPath),
      },
      {
        containerPath: SAMPLE_FILES.drawing.containerPath,
        absolutePath: path.join(SAMPLE_CONTAINER_PATH, SAMPLE_FILES.drawing.diskPath),
      },
    ]);

    // ExplorerView.vueはコンテナ一覧をマウント時にしか取得しないためリロードが必要
    await page.reload();
    await page.waitForLoadState('networkidle');
    await director.cursorShow();

    // コンテナ自体が折りたたまれたツリーの根として表示されるため、クリックして展開する
    const containerRow = page.getByText(containerName, { exact: true }).first();
    await containerRow.waitFor({ state: 'visible', timeout: 10000 });
    await mouse.clickLocator(containerRow);

    await page.locator('.exp-file, .exp-folder').filter({ hasText: '計算書' }).first().waitFor({
      state: 'visible',
      timeout: 10000,
    });

    // レビュー指摘: 「文書を開く」キャプションは02側の冒頭で出すと表示時間が短くなりすぎるため、
    // コンテナが展開され計算書ファイルが見えるようになった直後（＝01の締めのタイミング）で
    // 先に出しておく。02冒頭ではこのキャプションを出し直さず、そのまま操作を始める
    await director.caption('文書を開く', 'クリックひとつで計算書と図面をタブとして開けます。');
  },
};

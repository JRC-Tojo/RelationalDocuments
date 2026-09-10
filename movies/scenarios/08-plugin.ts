/**
 * シナリオ08: プラグイン機能の紹介
 *
 * 現時点でPLUGIN_STOREに公開されているのは「ページ番号スタンパー」（各ページにページ番号の
 * テキストボックスを配置するプラグイン）1つのみ。これを実際にインストール→実行し、
 * 「プラグインが文書に対して処理を適用する」という仕組みそのものを見せることで、
 * 将来的に自動照査系のプラグインが増えていく未来像につなげる。
 */
import { sleep } from '../lib/waits';
import type { Scenario } from './types';

export const plugin: Scenario = {
  id: '08-plugin',
  async run({ page, director, mouse }) {
    await director.caption(
      'プラグインで文書に処理を適用する',
      'Kumihimoから直接、文書に対してプラグインの処理を実行できます。',
    );

    const pluginRailTab = page.locator('.rail-tabs .q-tab').nth(2);
    await mouse.clickLocator(pluginRailTab);

    const pluginRow = page.locator('.q-item').filter({ hasText: 'ページ番号スタンパー' }).first();
    await pluginRow.waitFor({ state: 'visible', timeout: 8000 });
    await director.settle();

    const installIcon = pluginRow.locator('.q-icon:text-is("download")').first();
    if (await installIcon.isVisible().catch(() => false)) {
      await director.caption('プラグインをインストール', 'ストアから選んでワンクリックで導入できます。');
      await mouse.clickLocator(installIcon);
      await sleep(1000);
      await director.settle();
    }

    const installedRow = page.locator('.q-item').filter({ hasText: 'ページ番号スタンパー' }).first();
    const runIcon = installedRow.locator('.q-icon:text-is("play_arrow")').first();
    await runIcon.waitFor({ state: 'visible', timeout: 8000 });

    await director.caption(
      '文書に対して実行する',
      '将来的には、こうした仕組みで自動照査などの多様なプラグインが登場する予定です。',
    );
    await mouse.clickLocator(runIcon);

    const runButton = page.getByText('実行', { exact: true }).last();
    await runButton.waitFor({ state: 'visible', timeout: 8000 });
    await mouse.clickLocator(runButton);

    await sleep(2000);
    await director.settle();
  },
};

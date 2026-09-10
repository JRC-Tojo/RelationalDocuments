/**
 * kumihimoアプリ側にdata-testidが付いていない箇所（Quasarのアイコンボタン・タブ・メニュー項目）を
 * 操作するための小さな共通ヘルパー。data-testidが付与済みの主要ツール（アノテーション種別・
 * 関係性定義・表示モードメニューなど）は各シナリオから`page.locator('[data-testid="..."]')`で
 * 直接叩けばよく、ここには含めない。
 */
import type { Locator, Page } from '@playwright/test';
import type { SmoothMouse } from './smoothMouse';
import { sleep } from './waits';

/**
 * QuasarのMaterial Iconアイコンボタン（q-btn）を、アイコン名（q-icon要素のテキストと一致）で特定する。
 * `within`を渡すとその要素配下のみを検索し、同じアイコンを使う無関係なボタンとの誤爆を避けられる
 */
export function iconButton(page: Page, icon: string, within?: Locator): Locator {
  const root = within ?? page.locator('body');
  return root
    .locator('.q-btn')
    .filter({ has: page.locator(`.q-icon:text-is("${icon}")`) })
    .first();
}

/** QuasarのQTab（q-tabs内のタブ）をラベル文言で選択する */
export function tabByLabel(scope: Page | Locator, label: string): Locator {
  return scope.locator('.q-tab').filter({ hasText: label }).first();
}

/** q-menu/q-item構成のメニュー項目をラベル文言でクリックする */
export async function clickMenuItem(page: Page, label: string): Promise<void> {
  const item = page.locator('.q-item').filter({ hasText: label }).first();
  await item.waitFor({ state: 'visible' });
  await item.click();
}

/**
 * 要素の中心へ滑らかに移動してから右クリックする（コンテキストメニューを開く操作用）。
 * `SmoothMouse`は左クリック用の`click`/`clickLocator`しか持たないため、ここでは
 * `mouse.moveTo`で瞬間移動ではなく滑らかに移動させたうえで、Playwrightの`page.mouse.click`を
 * 右ボタン指定で呼び出す
 */
export async function rightClickLocator(page: Page, mouse: SmoothMouse, locator: Locator): Promise<void> {
  const rect = await mouse.rectOf(locator);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await mouse.moveTo(x, y);
  await page.mouse.click(x, y, { button: 'right' });
}

/**
 * クリックではなくホバーでのみ開くサブメニュー（`TabContextMenu.vue`の「別のペインに移動」等、
 * `scheduleOpenSubmenu`が定めるホバー遅延=400ms経過後にのみ`q-menu`が開く実装）を操作する
 * ためのヘルパー。対象の`q-item`をラベル文言で特定し、その上へ滑らかにマウスを移動させて
 * 留まることでホバー状態を保ち、サブメニューが開くのを待ってからそのルート`Locator`を返す。
 * 呼び出し側は戻り値の中から目的の項目をさらに`mouse.clickLocator`等で選択する
 */
export async function hoverToOpenSubmenu(
  page: Page,
  mouse: SmoothMouse,
  parentItemLabel: string,
): Promise<Locator> {
  const parentItem = page.locator('.q-item').filter({ hasText: parentItemLabel }).first();
  const rect = await mouse.rectOf(parentItem);
  // 急な瞬間移動ではなく、通常のマウス操作同様にゆっくり項目上へ移動して留まる
  await mouse.moveTo(rect.x + rect.width / 2, rect.y + rect.height / 2);

  // HOVER_OPEN_DELAY_MS(400ms)より確実に長く待ち、サブメニューが開く猶予を作る
  await sleep(600);

  // サブメニューもQuasarのq-menuとしてbody配下へポータルされ、role="menu"を持つ。
  // 右クリックで開いた親メニューも同じroleを持つため、後から追加された（=最後に見つかる）
  // ものをサブメニューとみなす
  const submenu = page.getByRole('menu').last();
  await submenu.waitFor({ state: 'visible', timeout: 3000 });
  return submenu;
}

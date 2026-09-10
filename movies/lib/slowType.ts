/**
 * テキスト入力欄に対して、人間が打っているように見える速度で1文字ずつ入力するヘルパー。
 *
 * `locator.fill()`は瞬時に値がセットされてしまい、動画として見たときに「検索できた」ことが
 * 伝わらない（07-search.ts等の検索デモで問題になった）。ここでは`locator.pressSequentially`
 * （Playwrightで`type`を置き換えた最新API。1文字ずつ実際のキーイベントを発火させる）を
 * 1文字ずつ呼び出し、文字ごとにランダムなゆらぎを持たせた待ち時間を挟むことで、
 * 実際にキーボードを打っているような見た目にする
 */
import type { Locator, Page } from '@playwright/test';
import { sleep } from './waits';

export interface TypeSlowlyOptions {
  /** 1文字あたりの基準の待ち時間（ミリ秒） */
  charDelayMs?: number;
  /** 基準時間に対して±でランダムに加える揺らぎの幅（ミリ秒） */
  charDelayJitterMs?: number;
}

const DEFAULT_CHAR_DELAY_MS = 110;
const DEFAULT_CHAR_DELAY_JITTER_MS = 60;

/**
 * `locator`をクリックしてフォーカスした上で、`text`を1文字ずつ入力する。
 * `page`自体は現状使わないが、将来的にページ全体に対する演出（例: 文字ごとのズーム追従）を
 * 加えやすいよう、他の`movies/`ヘルパーと同じ`(page, locator, ...)`の引数順に揃えている
 */
export async function typeSlowly(
  page: Page,
  locator: Locator,
  text: string,
  opts: TypeSlowlyOptions = {},
): Promise<void> {
  void page;
  const charDelayMs = opts.charDelayMs ?? DEFAULT_CHAR_DELAY_MS;
  const jitterMs = opts.charDelayJitterMs ?? DEFAULT_CHAR_DELAY_JITTER_MS;

  await locator.click();

  for (const char of text) {
    await locator.pressSequentially(char);
    const jitter = (Math.random() * 2 - 1) * jitterMs;
    await sleep(Math.max(30, charDelayMs + jitter));
  }
}

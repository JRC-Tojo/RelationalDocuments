/**
 * `browserSide.ts`の演出レイヤーをPlaywrightの`Page`にインストールし、
 * Node側（各シナリオ）から呼びやすい非同期APIとして公開するラッパー。
 */
import type { Page } from '@playwright/test';
import { initDirector, type DirectorTheme } from './browserSide';
import { THEME, CAPTION_FONT_STACK, TIMING } from '../config';
import { sleep } from '../lib/waits';

export class Director {
  constructor(private readonly page: Page) {}

  /** ナビゲーション前に呼ぶこと（`addInitScript`のため、これ以降の`page.goto`から効果を持つ） */
  async install(theme: DirectorTheme = THEME): Promise<void> {
    await this.page.addInitScript(initDirector, {
      theme,
      fontStack: CAPTION_FONT_STACK,
      timing: {
        captionFade: TIMING.captionFade,
        shortcutHold: TIMING.shortcutHold,
        zoomTransition: TIMING.zoomTransition,
      },
    });
  }

  /**
   * タイトル＋説明のキャプションを表示する。自動では消えないため、当該操作が続く間
   * ずっと画面に残り続ける。操作が終わる直前には`settle()`を呼んで明示的に消すこと
   */
  async caption(title: string, desc: string): Promise<void> {
    await this.page.evaluate(
      ({ title, desc }) => window.__director?.caption(title, desc),
      { title, desc },
    );
    await sleep(600);
  }

  clearCaption(): Promise<void> {
    return this.page.evaluate(() => window.__director?.clearCaption());
  }

  /**
   * 現在のキャプションを消し、定数時間（既定は`TIMING.captionGap`）だけ間を置く。
   * 一つの操作の締めくくりに呼ぶことで、次のキャプションに切り替わったことが
   * 視聴者にはっきり伝わる空白を作る
   */
  async settle(ms: number = TIMING.captionGap): Promise<void> {
    await this.clearCaption();
    await sleep(ms);
  }

  /** ショートカットキー／マウス操作の合図をキャプションとは別位置に一瞬表示する */
  async shortcut(text: string): Promise<void> {
    await this.page.evaluate((text) => window.__director?.shortcut(text), text);
    await sleep(300);
  }

  cursorShow(): Promise<void> {
    return this.page.evaluate(() => window.__director?.cursor.show());
  }

  cursorHide(): Promise<void> {
    return this.page.evaluate(() => window.__director?.cursor.hide());
  }

  /** 指定領域（ページ座標・CSS px）を画面いっぱいに強調ズームする */
  async zoomTo(
    rect: { x: number; y: number; width: number; height: number },
    scale?: number,
  ): Promise<void> {
    await this.page.evaluate(
      ({ rect, scale }) => window.__director?.zoom.to(rect, scale),
      { rect, scale },
    );
    await sleep(TIMING.zoomTransition + 100);
  }

  async zoomReset(): Promise<void> {
    await this.page.evaluate(() => window.__director?.zoom.reset());
    await sleep(TIMING.zoomTransition + 100);
  }
}

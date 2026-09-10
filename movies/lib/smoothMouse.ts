/**
 * 「画面遷移や操作が著しく飛ばない」滑らかなマウス移動・クリック・ドラッグを提供する。
 *
 * Playwrightの`page.mouse.move(x, y, { steps })`は等速の線形補間しかできないため、
 * ここではイージング（ease-in-out）付きで自前に細かく`mouse.move`を刻み、
 * 現在位置を内部で保持することで「前回の位置から」滑らかに繋げる。
 * 疑似カーソル（`director`）は実際の`mousemove`イベントを監視しているだけなので、
 * ここで本物のマウスを動かせば見た目のカーソルも自動的に追従する。
 */
import type { Locator, Page } from '@playwright/test';
import { sleep } from './waits';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class SmoothMouse {
  private pos = { x: 0, y: 0 };

  constructor(private readonly page: Page) {}

  /** 現在位置を強制的に上書きする（初回配置やクリック後の同期などに使う） */
  setPosition(x: number, y: number): void {
    this.pos = { x, y };
  }

  /** 現在位置から(x, y)まで、イージング付きで滑らかに移動する */
  async moveTo(x: number, y: number): Promise<void> {
    const from = this.pos;
    const distance = Math.hypot(x - from.x, y - from.y);
    if (distance < 1) {
      await this.page.mouse.move(x, y);
      this.pos = { x, y };
      return;
    }

    const steps = Math.min(60, Math.max(10, Math.round(distance / 10)));
    const duration = Math.min(1400, Math.max(280, distance * 1.1));
    const stepDelay = duration / steps;

    for (let i = 1; i <= steps; i++) {
      const t = easeInOutCubic(i / steps);
      const px = from.x + (x - from.x) * t;
      const py = from.y + (y - from.y) * t;
      await this.page.mouse.move(px, py);
      await sleep(stepDelay);
    }
    this.pos = { x, y };
  }

  /** 移動してからクリックする（押下の視覚フィードバックのため、down/upの間に短い間を置く） */
  async click(x: number, y: number): Promise<void> {
    await this.moveTo(x, y);
    await this.page.mouse.down();
    await sleep(90);
    await this.page.mouse.up();
  }

  /** LocatorのバウンディングボックスIDの中心座標へ滑らかに移動してクリックする（各シナリオの基本操作） */
  async clickLocator(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox();
    if (!box) throw new Error('要素のバウンディングボックスを取得できませんでした（非表示の可能性があります）');
    await this.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  /** Locatorの中心座標を取得するだけ（クリックせず、ズームの基準矩形などに使う） */
  async rectOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox();
    if (!box) throw new Error('要素のバウンディングボックスを取得できませんでした（非表示の可能性があります）');
    return box;
  }

  /**
   * 2点構成のアノテーション（直線・四角形など）をドラッグで描画する。
   * `handleMouseUp`側の判定（15px以上・150ms以上でドラッグ確定）を確実に満たすよう、
   * 押下後に少し待ってからゆっくり目的地まで動かす
   */
  async dragCreateAnnotation(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    await this.moveTo(from.x, from.y);
    await this.page.mouse.down();
    await sleep(200);
    await this.moveTo(to.x, to.y);
    await sleep(120);
    await this.page.mouse.up();
  }

  /**
   * 指定座標にマウスを合わせ、Ctrlキーを押した状態でホイールを刻んで実際のズーム機能を操作する
   * （CSS transformによる見た目だけのズーム`director.zoomTo`とは異なり、本物のPDFズーム機能を使う）。
   *
   * `src/components/DocLayout/DocumentViewer.vue`の`handleZoomWheel`はCtrl+ホイール1回につき
   * `zoomSteps.ts`のズーム段階を1段階だけ進める実装（deltaYの符号のみ見る）のため、大きく1回
   * 動かしても意味がない。ここでは`ticks`回に分けて細かくホイールイベントを送ることで、
   * 段階を1つずつ踏みながら滑らかにズームしているように見せる
   */
  async ctrlWheelZoom(x: number, y: number, ticks: number, zoomIn: boolean): Promise<void> {
    await this.moveTo(x, y);
    await this.page.keyboard.down('Control');
    try {
      const deltaY = zoomIn ? -100 : 100;
      for (let i = 0; i < ticks; i++) {
        await this.page.mouse.wheel(0, deltaY);
        await sleep(250);
      }
    } finally {
      await this.page.keyboard.up('Control');
    }
  }
}

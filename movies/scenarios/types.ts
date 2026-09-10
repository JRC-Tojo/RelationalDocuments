import type { Page } from '@playwright/test';
import type { Director } from '../director/director';
import type { SmoothMouse } from '../lib/smoothMouse';

/** 各シナリオに渡す共有コンテキスト。record.spec.tsが1つだけ作って全シナリオに渡す */
export interface MovieContext {
  page: Page;
  director: Director;
  mouse: SmoothMouse;
}

export interface Scenario {
  /** ログ表示用の短いID（例: "01-createContainer"） */
  id: string;
  /** 実際の撮影処理。ここで例外を投げると録画全体が即座に中断される */
  run(ctx: MovieContext): Promise<void>;
}

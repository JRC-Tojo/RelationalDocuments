/**
 * ページ内（ブラウザ側）に注入する「演出レイヤー」の実体。
 *
 * `director.ts`（Node側）から`page.addInitScript(initDirector, opts)`として注入される。
 * Playwrightの`addInitScript`は関数を`toString()`で文字列化してページ内に丸ごと実行するため、
 * このファイルはトップレベル変数など外側のクロージャに依存してはいけない（自己完結している必要がある）。
 * 呼び出し側（Node側）はこの関数を直接importして型チェックの恩恵を受けつつ、実行はブラウザ側で行う。
 */

export interface DirectorTheme {
  purple: string;
  gold: string;
  purpleDeep: string;
  ink: string;
}

export interface DirectorOptions {
  theme: DirectorTheme;
  fontStack: string;
  timing: {
    captionFade: number;
    shortcutHold: number;
    zoomTransition: number;
  };
}

/** ブラウザ側で`window.__director`として公開されるAPIの型（Node側からの型参照用） */
export interface DirectorApi {
  /** 表示したまま保持する。次の`caption()`または`clearCaption()`が呼ばれるまで消えない */
  caption(title: string, desc: string): void;
  clearCaption(): void;
  shortcut(text: string): void;
  cursor: {
    show(): void;
    hide(): void;
  };
  zoom: {
    to(rect: { x: number; y: number; width: number; height: number }, scale?: number): void;
    reset(): void;
  };
}

declare global {
  interface Window {
    __director?: DirectorApi;
  }
}

/**
 * ブラウザ内で実行され、`window.__director`を組み立てるエントリポイント。
 * 冪等（複数回呼ばれても二重にDOMを作らない）にしてあり、SPAの再ナビゲーションでも安全。
 */
export function initDirector(opts: DirectorOptions): void {
  if (window.__director) return;

  const { theme, fontStack, timing } = opts;
  const NS = 'kumihimo-director';
  const CAPTION_BOTTOM_PX = 32; // #${NS}-caption の bottom と一致させる
  const SHORTCUT_GAP_PX = 16; // キャプション上端からショートカットバッジ下端までの余白

  let root: HTMLDivElement | null = null;
  let styleInjected = false;
  let zoomWrapper: HTMLElement | null = null;
  let captionEl: HTMLDivElement | null = null;
  let shortcutEl: HTMLDivElement | null = null;
  let cursorDot: HTMLDivElement | null = null;
  let shortcutHideTimer: number | undefined;

  /** 演出用CSSを一度だけ<head>に追加する */
  function injectStyle(): void {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-source', NS);
    style.textContent = `
      #${NS}-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: ${fontStack}; }
      #${NS}-zoom-wrapper { transform-origin: 0 0; transition: transform ${timing.zoomTransition}ms cubic-bezier(0.4, 0, 0.2, 1); }
      #${NS}-caption {
        position: absolute; left: 32px; bottom: 32px; transform: translateY(12px);
        min-width: 360px; max-width: 56vw; padding: 18px 28px;
        background: linear-gradient(135deg, ${theme.purpleDeep} 0%, ${theme.purple} 100%);
        border: 1px solid ${theme.gold}; border-radius: 14px;
        box-shadow: 0 10px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(217,166,46,0.15) inset;
        color: ${theme.ink}; opacity: 0; transition: opacity ${timing.captionFade}ms ease, transform ${timing.captionFade}ms ease;
      }
      #${NS}-caption.is-visible { opacity: 1; transform: translateY(0); }
      #${NS}-caption-title { font-size: 20px; font-weight: 700; letter-spacing: 0.02em; color: ${theme.gold}; margin: 0 0 6px; }
      #${NS}-caption-desc { font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-line; }
      /* ショートカット/マウス操作バッジ。初見で見落とされないよう、視線が集まるキャプションと
         同じ左下の位置（その少し上）に重ねて表示する（以前は右上に表示していた） */
      #${NS}-shortcut {
        position: absolute; left: 32px; padding: 10px 18px;
        background: ${theme.purpleDeep}; border: 1px solid ${theme.gold}; border-radius: 999px;
        color: ${theme.gold}; font-size: 14px; font-weight: 700; letter-spacing: 0.04em;
        box-shadow: 0 6px 18px rgba(0,0,0,0.3); opacity: 0; transform: translateY(8px) scale(0.96);
        transition: opacity 220ms ease, transform 220ms ease;
      }
      #${NS}-shortcut.is-visible { opacity: 1; transform: translateY(0) scale(1); }
      #${NS}-cursor {
        position: fixed; top: 0; left: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px;
        border-radius: 50%; border: 2px solid ${theme.gold};
        background: radial-gradient(circle, ${theme.purple} 0%, transparent 70%);
        box-shadow: 0 0 10px rgba(217,166,46,0.7); opacity: 0; transition: opacity 200ms ease, transform 80ms ease;
        will-change: transform;
      }
      #${NS}-cursor.is-visible { opacity: 0.9; }
      #${NS}-cursor.is-down { transform: scale(0.7); }
      @keyframes ${NS}-ripple {
        from { transform: scale(0.4); opacity: 0.9; }
        to { transform: scale(2.4); opacity: 0; }
      }
      .${NS}-ripple {
        position: fixed; top: 0; left: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px;
        border-radius: 50%; border: 2px solid ${theme.gold}; pointer-events: none;
        z-index: 2147483000; animation: ${NS}-ripple 500ms ease-out forwards;
      }
    `;
    document.head.appendChild(style);
  }

  /** 演出レイヤーのDOM一式を初回利用時に組み立てる（documentがまだ準備できていなければ後で再試行する） */
  function ensureRoot(): boolean {
    if (root) return true;
    if (!document.body) return false;

    injectStyle();

    // アプリ本体（#q-app）をズーム用ラッパーで包む。演出オーバーレイ自体はラッパーの外（bodyの直下）に
    // 置くことで、ズーム倍率の影響を受けずに常に等倍でキャプション等を表示できる
    const appRoot = document.getElementById('q-app');
    if (appRoot && appRoot.parentElement && !document.getElementById(`${NS}-zoom-wrapper`)) {
      const wrapper = document.createElement('div');
      wrapper.id = `${NS}-zoom-wrapper`;
      appRoot.parentElement.insertBefore(wrapper, appRoot);
      wrapper.appendChild(appRoot);
      zoomWrapper = wrapper;
    } else {
      zoomWrapper = document.getElementById(`${NS}-zoom-wrapper`);
    }

    root = document.createElement('div');
    root.id = `${NS}-root`;
    document.body.appendChild(root);

    captionEl = document.createElement('div');
    captionEl.id = `${NS}-caption`;
    captionEl.innerHTML = `<p id="${NS}-caption-title"></p><p id="${NS}-caption-desc"></p>`;
    root.appendChild(captionEl);

    shortcutEl = document.createElement('div');
    shortcutEl.id = `${NS}-shortcut`;
    root.appendChild(shortcutEl);

    // キャプションは説明文が2行に折り返すと高さが変わるため、固定オフセットではバッジと重なる。
    // 実際の高さをResizeObserverで監視し、常にキャプション上端の少し上にバッジを再配置する
    const positionShortcut = (): void => {
      if (!captionEl || !shortcutEl) return;
      shortcutEl.style.bottom = `${CAPTION_BOTTOM_PX + captionEl.offsetHeight + SHORTCUT_GAP_PX}px`;
    };
    new ResizeObserver(positionShortcut).observe(captionEl);

    cursorDot = document.createElement('div');
    cursorDot.id = `${NS}-cursor`;
    root.appendChild(cursorDot);

    // 実際のPlaywrightのmouse.move/down/upはページに本物のマウスイベントを発火させるため、
    // それをそのまま拾って疑似カーソルを追従させる（Node側から座標を送り直す必要がない）
    window.addEventListener(
      'mousemove',
      (e) => {
        if (cursorDot) cursorDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      },
      { capture: true },
    );
    window.addEventListener(
      'mousedown',
      (e) => {
        cursorDot?.classList.add('is-down');
        spawnRipple(e.clientX, e.clientY);
      },
      { capture: true },
    );
    window.addEventListener('mouseup', () => cursorDot?.classList.remove('is-down'), {
      capture: true,
    });

    return true;
  }

  function spawnRipple(x: number, y: number): void {
    const ripple = document.createElement('div');
    ripple.className = `${NS}-ripple`;
    ripple.style.transform = `translate(${x}px, ${y}px)`;
    document.body.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 550);
  }

  const api: DirectorApi = {
    /**
     * タイトル＋説明（2行程度）のキャプションを画面左下に表示する。
     * 自動では消えない（当該操作が続く間ずっと表示され続ける）。次の操作に移る直前に
     * Node側から`director.settle()`を呼んで明示的に消すこと
     */
    caption(title, desc) {
      if (!ensureRoot() || !captionEl) return;
      captionEl.querySelector(`#${NS}-caption-title`)!.textContent = title;
      captionEl.querySelector(`#${NS}-caption-desc`)!.textContent = desc;
      captionEl.classList.add('is-visible');
    },
    clearCaption() {
      captionEl?.classList.remove('is-visible');
    },
    /** ショートカットキー／マウス操作の一瞬の合図を、キャプションとは別位置（右上）に表示する */
    shortcut(text) {
      if (!ensureRoot() || !shortcutEl) return;
      shortcutEl.textContent = text;
      shortcutEl.classList.add('is-visible');
      window.clearTimeout(shortcutHideTimer);
      shortcutHideTimer = window.setTimeout(
        () => shortcutEl?.classList.remove('is-visible'),
        timing.shortcutHold,
      );
    },
    cursor: {
      show() {
        if (!ensureRoot()) return;
        cursorDot?.classList.add('is-visible');
      },
      hide() {
        cursorDot?.classList.remove('is-visible');
      },
    },
    zoom: {
      /** 指定した矩形（ページ座標、CSS px）が画面いっぱいに収まるよう、アプリ全体をCSS transformで拡大する */
      to(rect, scale) {
        if (!ensureRoot() || !zoomWrapper) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const fitScale = Math.min(vw / rect.width, vh / rect.height);
        const effectiveScale = scale ?? Math.min(fitScale, 3);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const tx = vw / 2 - cx * effectiveScale;
        const ty = vh / 2 - cy * effectiveScale;
        zoomWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${effectiveScale})`;
      },
      reset() {
        if (zoomWrapper) zoomWrapper.style.transform = '';
      },
    },
  };

  window.__director = api;
}

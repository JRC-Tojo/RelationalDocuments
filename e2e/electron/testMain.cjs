// E2E専用の最小Electronメインプロセス。
//
// 本番の`src-electron/electronMain.ts`はQuasar CLI（esbuild）でコンパイルされる前提のため、
// Playwrightのテストランナー（Node.js）から直接実行できる成果物ではない。ここでは
// TypeScriptのビルドパイプラインに依存せず安定してPlaywrightから起動できるよう、
// プレーンなCommonJSとして「本番と同じ土俵（実Electronのレンダラー内）で既存のPWA/E2E仕様を
// 検証する」ことだけに専念した最小ウィンドウを用意する。読み込み先は`bun run dev`が起動する
// 既存のVite開発サーバー（`E2E_APP_URL`環境変数、既定は`http://localhost:9200`）を共有する
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'testPreload.cjs'),
    },
  });
  const url = process.env.E2E_APP_URL || 'http://localhost:9200';
  void win.loadURL(url);
});

app.on('window-all-closed', () => {
  app.quit();
});

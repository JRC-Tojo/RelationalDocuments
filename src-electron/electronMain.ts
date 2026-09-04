// package.jsonの"type": "module"によりElectron本体もESMとしてロードされるが、
// Electronの組み込み'electron'モジュールはESM経由では名前付きexportを提供しない既知の制約があるため、
// デフォルトインポートしてから分割代入する
import electron from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const { app, BrowserWindow } = electron;

// Linuxではprocess.platformが取得できない場合があるためフォールバックする
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: Electron.BrowserWindow | undefined;

/**
 * メインウィンドウを生成する。
 * 開発時はViteの開発サーバURL（APP_URL）を、本番時はパッケージ済みの静的ファイル（index.html）を読み込む。
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'),
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // レンダラープロセスからNode API等へ直接アクセスさせないためのセキュリティ境界。
      // 詳細: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electronPreload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION,
        ),
      ),
    },
  });

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL);
  } else {
    await mainWindow.loadFile('index.html');
  }

  if (process.env.DEBUGGING) {
    // 開発時、または本番でもデバッグが有効な場合のみDevToolsを開く
    mainWindow.webContents.openDevTools();
  } else {
    // 本番環境ではDevToolsへのアクセスを許可しない
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

void app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // macOSでは全ウィンドウが閉じてもDockにアプリを残す慣習に合わせる
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    void createWindow();
  }
});

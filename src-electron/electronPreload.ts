/**
 * プリロードスクリプト。`contextIsolation: true`のもとでレンダラープロセスとNode/Electron APIとの
 * 間のセキュリティ境界となるファイル。`contextBridge.exposeInMainWorld(...)`でrenderer側の
 * `window`オブジェクトへ必要な機能だけを限定公開する。
 *
 * package.jsonの"type": "module"により本体もESMとしてロードされるが、Electronの組み込み
 * 'electron'モジュールはESM経由では名前付きexportを提供しない既知の制約があるため、
 * デフォルトインポートしてから分割代入する（electronMain.tsと同じ対処）
 */
import electron from 'electron';
import type { KumihimoElectronApi } from '../src/repositories/platform/electron';

const { contextBridge, ipcRenderer, webUtils } = electron;

/**
 * `window.kumihimoElectron`として公開するAPI。`src/repositories/platform/electron.ts`の
 * `KumihimoElectronApi`型を満たすことで、レンダラー側の呼び出しと型を一致させる
 */
const kumihimoElectronApi: KumihimoElectronApi = {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // shell.openPathの実処理はメインプロセス側（electronMain.ts）のipcMain.handleで行う
  openPath: (path) => ipcRenderer.invoke('shell:open-path', path) as Promise<string>,
};

contextBridge.exposeInMainWorld('kumihimoElectron', kumihimoElectronApi);

// E2E専用のプリロードスクリプト。
//
// 本番の`src-electron/electronPreload.ts`が公開する`window.kumihimoElectron`と同じ形の
// APIを最小構成で再現し、「Electron版だけに存在する機能（標準アプリで起動するボタン等）」を
// E2Eから検証できるようにする。`openPath`はE2E環境で実際にOSの外部アプリを起動させたくない
// ため、呼び出しを記録するだけのスタブとする（呼び出し履歴は`getRecordedOpenPathCalls`経由で
// テスト側から参照できる）
const { contextBridge, webUtils } = require('electron');

const openPathCalls = [];

contextBridge.exposeInMainWorld('kumihimoElectron', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openPath: async (targetPath) => {
    openPathCalls.push(targetPath);
    return '';
  },
  /** E2Eテスト専用: これまでにopenPathへ渡された絶対パスの一覧を返す */
  getRecordedOpenPathCalls: () => openPathCalls.slice(),
});

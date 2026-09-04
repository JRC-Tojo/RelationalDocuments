/**
 * Electronデスクトップアプリ環境固有の機能へのアクセスを提供する
 *
 * `src-electron/electronPreload.ts`が`contextBridge.exposeInMainWorld('kumihimoElectron', ...)`
 * で公開したAPIをラップする。ブラウザ/PWA環境ではこのAPIは存在しないため、呼び出し側は必ず
 * `isElectronRuntime()`で分岐すること（`src/repositories/document/localFontAccess.ts`の
 * `isLocalFontAccessSupported`と同じ「対応可否判定関数＋呼び出し側での分岐」パターン）
 */
import { Failure, Success, toError, type Result } from 'src/models/error/result';

/** プリロードスクリプトがレンダラープロセスへ公開するElectron固有APIの形状 */
export interface KumihimoElectronApi {
  /**
   * File System Access API由来のFileオブジェクトから、OS上の絶対パスを取得する
   * （取得できない場合はundefined）
   */
  getPathForFile(file: File): string | undefined;
  /** 指定した絶対パスをOSの標準アプリで開く。失敗時はエラーメッセージを、成功時は空文字列を返す */
  openPath(path: string): Promise<string>;
}

declare global {
  interface Window {
    kumihimoElectron?: KumihimoElectronApi;
  }
}

/** Electronのデスクトップアプリとして実行されているかどうか */
export function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && window.kumihimoElectron !== undefined;
}

/**
 * 指定したFileオブジェクトの実体を、OSの標準アプリで開く
 *
 * Electron環境でのみ動作する。File System Access API経由のFileであっても、Electronの
 * Chromiumは実ファイルへの絶対パスを保持しているため`webUtils.getPathForFile`で取得できる
 * （ブラウザではセキュリティ上この経路が存在しないため、事前に`isElectronRuntime()`で
 * 分岐しておくこと）
 */
export async function openFileWithDefaultApp(file: File): Promise<Result<void>> {
  const api = window.kumihimoElectron;
  if (api === undefined) {
    return Failure(new Error('この機能はデスクトップアプリ版でのみ利用できます'));
  }

  const path = api.getPathForFile(file);
  if (path === undefined || path === '') {
    return Failure(new Error('ファイルの実体パスを取得できませんでした'));
  }

  try {
    // shell.openPathは失敗時にエラーメッセージ文字列を、成功時は空文字列を返す
    // （Promiseのrejectではなくresolve値でエラーを表現するElectronのAPI仕様）
    const errMessage = await api.openPath(path);
    if (errMessage !== '') {
      return Failure(new Error(errMessage));
    }
    return Success();
  } catch (e) {
    return Failure(toError(e));
  }
}

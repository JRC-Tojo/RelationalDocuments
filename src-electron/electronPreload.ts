/**
 * プリロードスクリプト。`contextIsolation: true`のもとでレンダラープロセスとNode/Electron APIとの
 * 間のセキュリティ境界となるファイル。`contextBridge.exposeInMainWorld(...)`でrenderer側の
 * `window`オブジェクトへ必要な機能だけを限定公開する。
 *
 * フェーズ1（Electronビルド基盤の整備）では公開するAPIはまだ無い。
 * ネイティブファイル関連付け・カスタムURI起動時のファイルパス受け渡しなどは、
 * それらに対応する後続issueでここに追加する想定。
 */
export {};

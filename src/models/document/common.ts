import z from 'zod';

/**
 * 各文書と並列に保存する設定ファイルの拡張子
 */
export const CONFIG_FILE_EXTS = '.kcfg';

/**
 * 文書設定ファイル名（新形式）を構築する
 *
 * OS上のファイルエクスプローラでもできる限り隠しファイルとして扱われるよう、
 * ファイル名の先頭にドットを付与する（例: "report.pdf" → ".report.pdf.kcfg"）。
 * これによりmacOS/LinuxのFinder・`ls`コマンドでは既定で非表示になるが、
 * Windows Explorerはドットプレフィックスを隠しファイルの条件としないため、
 * Windows上では引き続き表示される（アプリ内一覧からは別途除外済みのため実害は小さい）
 */
export function buildConfigFileName(sourceBaseName: string): string {
  return `.${sourceBaseName}${CONFIG_FILE_EXTS}`;
}

/**
 * 文書設定ファイル名（旧形式・先頭ドット無し）を構築する
 *
 * 新形式（`buildConfigFileName`）導入以前に作成された既存コンテナとの後方互換のためだけに使う
 * （フォールバック読み込み・削除・リネーム追従の探索用）。新規書き込みでは使用しない
 */
export function buildLegacyConfigFileName(sourceBaseName: string): string {
  return `${sourceBaseName}${CONFIG_FILE_EXTS}`;
}

/**
 * ファイル名が文書設定ファイル（新形式・旧形式いずれか）かどうかを判定する
 */
export function isConfigFileName(name: string): boolean {
  return name.endsWith(CONFIG_FILE_EXTS);
}

/**
 * 文書設定ファイル名から、対応する文書本体のファイル名（拡張子込みのbasename）を復元する
 *
 * 新形式（先頭ドット付き）・旧形式（先頭ドット無し）のどちらであっても対応する文書名を返す。
 * 対象外の名前（`.kcfg`で終わらない）を渡した場合はそのまま返す
 */
export function getSourceBaseNameFromConfigFileName(configFileName: string): string {
  const withoutExt = configFileName.endsWith(CONFIG_FILE_EXTS)
    ? configFileName.slice(0, -CONFIG_FILE_EXTS.length)
    : configFileName;
  return withoutExt.startsWith('.') ? withoutExt.slice(1) : withoutExt;
}

/**
 * 本システムが内容を表示できる文書の拡張子
 *
 * これ以外の拡張子はエクスプローラー上には表示するが、タブを開くと非対応メッセージを表示する
 */
export const SUPPORTED_DOCUMENT_EXTS = ['.pdf', '.txt', '.md'] as const;

/**
 * 文書の本体データ
 */
export const DocumentSource = z.base64().brand('DocumnetSource');
export type DocumentSource = z.infer<typeof DocumentSource>;

/**
 * アプリ操作紹介動画の撮影スクリプト全体で共有する設定値。
 * シナリオ・演出（キャプション/ズーム/カーソル）の見た目やタイミングを調整したい場合はここを編集する。
 */

/** 撮影に使う実コンテナフォルダ（実業務PDFを含む）。環境が変わる場合はここだけ書き換えればよい */
export const SAMPLE_CONTAINER_PATH =
  'C:\\Users\\tojo\\Documents\\BUSINESS\\Tools\\kumihimo\\サンプルコンテナ';

/**
 * サンプルコンテナ配下の主要ファイル。`diskPath`は実フォルダ内の実際の相対パス（読み込み元）、
 * `containerPath`はシード先のcacheコンテナ内でのパス。
 *
 * cacheコンテナのファイル一覧はパスの区切り（"/"）から自動でフォルダを推測してくれるわけではなく、
 * 明示的なフォルダ要素が無いとExplorerに表示されない（実際に検証して確認した）ため、
 * containerPath側はフォルダを持たないフラットな名前にしている
 */
export const SAMPLE_FILES = {
  calculationSheet: { diskPath: '計算書・図面/計算書.pdf', containerPath: '計算書.pdf' },
  drawing: { diskPath: '計算書・図面/一般図.pdf', containerPath: '一般図.pdf' },
} as const;

/** 録画解像度。プレゼン用途のため1280x800のE2E既定より大きめにする */
export const VIEWPORT = { width: 1600, height: 900 };

/** メイン画面のブランドカラーをそのまま踏襲する（src/css/quasar.variables.scssより） */
export const THEME = {
  /** ライトモードのprimary（紫） */
  purple: '#6846a5',
  /** ダークモードのprimary-dark（金、差し色として使う） */
  gold: '#d9a62e',
  /** キャプション背景（紫を深く暗くした色。動画のオーバーレイが本文を隠しすぎないように半透明で使う） */
  purpleDeep: '#2e1f4d',
  ink: '#f5f1ff',
} as const;

/** プレゼン用に見やすいフォント。ネットワーク越しのWebフォントに依存せず、
 *  OS標準の日本語フォントのみで組む（撮影中のネットワーク遅延で崩れるのを避けるため） */
export const CAPTION_FONT_STACK =
  '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Noto Sans JP", "Segoe UI", sans-serif';

/** 各種演出のデフォルト秒数（ミリ秒） */
export const TIMING = {
  /** キャプションのフェードイン/アウト */
  captionFade: 400,
  /**
   * キャプションを消してから次のキャプションを表示するまでの間（定数秒）。
   * キャプションは操作中ずっと表示し続け、その操作が終わる直前に`director.settle()`で
   * 一旦消す。この空白があることで「次のキャプションに切り替わった」ことが視聴者に伝わる
   */
  captionGap: 500,
  /** ショートカット/マウス操作バッジの表示時間 */
  shortcutHold: 1400,
  /** カーソルの滑らかな移動にかける時間の目安（px/msではなく1移動あたりの基準時間） */
  cursorMoveBase: 500,
  /** ズームイン/アウトのトランジション時間 */
  zoomTransition: 700,
  /** ズームインした状態を保持する時間 */
  zoomHold: 1800,
} as const;

/** 録画動画の出力先 */
export const OUTPUT_DIR = 'movies/output';

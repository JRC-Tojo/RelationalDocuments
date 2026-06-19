/**
 * API レスポンススキーマ（Result型対応版）
 * Result<T>をフロントエンドに返す際に使用
 */

/**
 * APIエラーキー定義（コンソールメッセージなどで使用可能）
 *
 * TODO: 今後エラーメッセージの表示機構を整えたら移動させる
 */
export const ApiErrorKeys = {
  // 認証関連
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  // ドキュメント関連
  DOC_NOT_FOUND: 'DOC_NOT_FOUND',
  DOC_SAVE_FAILED: 'DOC_SAVE_FAILED',
  DOC_PARSE_ERROR: 'DOC_PARSE_ERROR',
  // ストレージ関連
  STORAGE_READ_ERROR: 'STORAGE_READ_ERROR',
  STORAGE_WRITE_ERROR: 'STORAGE_WRITE_ERROR',
  // 検証関連
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // サーバー関連
  SERVER_ERROR: 'SERVER_ERROR',
  // その他
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ApiErrorKey = (typeof ApiErrorKeys)[keyof typeof ApiErrorKeys];

/**
 * APIエラー情報
 * key: エラーの識別子
 * message: ユーザーに表示するメッセージテンプレート（${variable}形式で変数を埋め込み可能）
 * variables?: メッセージに埋め込む変数
 */
export interface ApiErrorInfo {
  key: ApiErrorKey;
  message: string;
  variables?: Record<string, string | number | boolean>;
  details?: unknown; // デバッグ用の詳細情報
}

/**
 * API レスポンススキーマ（Result型対応版）
 */
export interface ApiResponseSuccess<T> {
  ok: true;
  data: T;
  timestamp: Date;
  requestId?: string; // リクエスト追跡用
}

export interface ApiResponseFailure {
  ok: false;
  error: ApiErrorInfo;
  timestamp: Date;
  requestId?: string; // リクエスト追跡用
}

export type ApiResponse<T = void> = ApiResponseSuccess<T> | ApiResponseFailure;

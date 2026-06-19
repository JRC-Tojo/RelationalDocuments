/**
 * ユーザー固有の設定を保存しておく
 */

import { AppSettings } from 'src/models/schemas';
import { getValue, setValue } from 'src/repositories/storage/cache';

const SETTINGS_STORE_NAME = 'settings'

/**
 * ユーザー設定を取得する
 */
export async function getSettings(): Promise<AppSettings> {
  return getValue(SETTINGS_STORE_NAME, AppSettings)
}

/**
 * ユーザー設定を保存する
 */
export async function saveSettings<T extends AppSettings, K extends keyof T>(
  key: K,
  value: T[K],
): Promise<AppSettings> {
  return setValue(SETTINGS_STORE_NAME, key, value)
}

/**
 * ユーザー固有の設定を保存しておく
 */

import type { AnnotationTool } from 'src/models/docPage';
import { Success, type Result } from 'src/models/error/result';
import { AppSettings } from 'src/models/schemas';
import { getValue, setValue } from 'src/repositories/storage/cache';

const SETTINGS_STORE_NAME = 'settings';

/**
 * ユーザー設定を取得する
 */
export async function getSettings(): Promise<Result<AppSettings>> {
  return getValue(SETTINGS_STORE_NAME, AppSettings);
}

/**
 * ユーザー設定を保存する
 */
export async function saveSettings<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<Result<void>> {
  return setValue(SETTINGS_STORE_NAME, key, value);
}

export async function initializeSettings(): Promise<Result<AppSettings>> {
  const def: AppSettings = {
    darkMode: false,
    viewMode: 'rich',
    sortBy: 'updatedAt',
    initialized: true,
    tools: {
      annotations: defaultAnnotationTools,
    },
  } as const;

  const res = await Promise.all(
    Object.entries(def).map(([k, v]) => setValue(SETTINGS_STORE_NAME, k, v)),
  );
  const errRes = res.find((r) => !r.ok);

  if (errRes === void 0) {
    return Success();
  } else {
    return errRes;
  }
}

const defaultAnnotationTools: AnnotationTool[] = [
  {
    id: 'line-preset-1',
    name: '実線（黒）',
    style: {
      type: 'line',
      strokeColor: '#000000',
      strokeType: 'solid',
      strokeWidth: 5,
      strokeOpacity: 1,
    },
  },
  {
    id: 'line-preset-2',
    name: '点線（赤）',
    style: {
      type: 'line',
      strokeColor: '#FF0000',
      strokeType: 'dash-dot',
      strokeWidth: 10,
      strokeOpacity: 1,
    },
  },
  {
    id: 'box-preset-1',
    name: 'ボックス（青枠）',
    style: {
      type: 'box',
      strokeColor: '#0000FF',
      strokeWidth: 5,
      strokeType: 'solid',
      strokeOpacity: 1,
      fillColor: '#0000FF',
      fillPattern: 'solid',
      fillOpacity: 0.5,
    },
  },
  {
    id: 'circle-preset-1',
    name: '円（緑枠）',
    style: {
      type: 'circle',
      strokeColor: '#009900',
      strokeWidth: 3,
      strokeType: 'solid',
      strokeOpacity: 1,
      fillColor: '#009900',
      fillPattern: 'solid',
      fillOpacity: 0.3,
    },
  },
];

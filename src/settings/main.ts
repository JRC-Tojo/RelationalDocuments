/**
 * ユーザー固有の設定を保存しておく
 */

import type { ContainerID, ContainerSkel } from 'src/models/container';
import type { AnnotationTool } from 'src/models/docPage';
import { Success, type Result } from 'src/models/error/result';
import { AppSettings } from 'src/models/settings';
import * as db from 'src/repositories/inMemory/IndexedDB';

const SETTINGS_STORE_NAME = 'settings';

/**
 * 設定の初期化
 */
export async function initializeSettings(): Promise<Result<AppSettings>> {
  const def: AppSettings = {
    darkMode: false,
    viewMode: 'rich',
    sortBy: 'updatedAt',
    initialized: true,
    containerSkels: [],
    tools: {
      annotations: defaultAnnotationTools,
    },
  } as const;

  const res = await Promise.all(
    Object.entries(def).map(([k, v]) => db.setValue(SETTINGS_STORE_NAME, k, v)),
  );
  const errRes = res.find((r) => !r.ok);

  if (errRes === void 0) {
    return Success();
  } else {
    return errRes;
  }
}

/**
 * ユーザー設定を取得する
 */
export async function getSettings(): Promise<Result<AppSettings>> {
  return db.getValue(SETTINGS_STORE_NAME, AppSettings);
}

/**
 * ユーザー設定を保存する
 */
export async function saveSettings<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<Result<void>> {
  return db.setValue(SETTINGS_STORE_NAME, key, value);
}

/**
 * 読み込み対象のコンテナを追加する
 */
export async function addLoadedContainer(c: ContainerSkel): Promise<Result<void>> {
  const settingsRes = await getSettings();
  if (!settingsRes.ok) return settingsRes;

  const settings = settingsRes.value;
  const newContainers = [...settings.containerSkels, c];
  return saveSettings('containerSkels', newContainers);
}

/**
 * 読み込み対象のコンテナを削除する
 */
export async function removeLoadedContainer(cId: ContainerID): Promise<Result<void>> {
  const settingsRes = await getSettings();
  if (!settingsRes.ok) return settingsRes;

  const settings = settingsRes.value;
  const newContainers = settings.containerSkels.filter((c) => c.id !== cId);
  return saveSettings('containerSkels', newContainers);
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

import type { AppSettings } from 'src/models/schemas';
import { localStorageRepository } from '../repositories/localStorageRepository';
import type { AnnotationTool } from 'src/models/docPage';

/**
 * アプリケーション設定サービス
 */
class SettingsService {
  /**
   * 設定を取得
   */
  async getSettings(): Promise<AppSettings> {
    const loadedSettings = await localStorageRepository.getSettings();
    if (loadedSettings === null) {
      const defaultSettings = await this.initializeDefaultSettings();
      await this.saveSettings(defaultSettings);
      return defaultSettings;
    } else {
      return loadedSettings;
    }
  }

  /**
   * 設定を保存
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    await localStorageRepository.saveSettings(settings);
  }

  /**
   * デフォルト設定を初期化
   */
  async initializeDefaultSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      darkMode: false,
      viewMode: 'rich',
      sortBy: 'updatedAt',
      initialized: true,
      tools: {
        annotations: defaultAnnotationTools,
      },
    };

    await this.saveSettings(defaultSettings);
    return defaultSettings;
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

export const settingsService = new SettingsService();

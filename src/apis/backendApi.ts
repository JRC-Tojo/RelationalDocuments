import { getSettings, initializeSettings, saveSettings } from 'src/settings/main';
import type { DocumentMetadata, Annotation } from '../models/schemas';
import { toApiResponse, type ApiResponse } from 'src/models/error/api';
import { Failure, Success } from 'src/models/error/result';
import * as containerService from 'src/services/container/main';
import type { ContainerElement } from 'src/models/container';
import type { Document } from 'src/models/document/common';
import { AppSettings } from 'src/models/settings';

/**
 * バックエンド統合 API層
 * フロントエンドから関数呼び出しで各サービスを利用
 * 将来的なAPI通信化にも対応できるように設計
 */
class BackendApi {
  /**
   * 初期化
   */
  async initialize(): Promise<ApiResponse<void>> {
    const settings = await getSettings();
    if (!settings.ok) {
      return toApiResponse(settings, 'INIT_PROCESS_ERROR');
    }

    if (!settings.value.initialized) {
      const initRes = await initializeSettings();
      if (!initRes.ok) return toApiResponse(initRes, 'INIT_PROCESS_ERROR');
    }

    return toApiResponse(Success());
  }

  // ============ 文書操作 ============

  /**
   * 全文書を取得
   */
  async getAllDocuments(): Promise<ApiResponse<ContainerElement[]>> {
    // 保存済みのコンテナ情報を取得
    const allContainers = await containerService.getAllContainers();
    if (!allContainers.ok) return toApiResponse(allContainers, 'DOC_LIST_FAILED');

    // TODO: 将来的には「コンテナ取得」と「コンテナ読み込み」は分離するが、現状はフロントエンドに媚びた実装
    // コンテナの要素をすべて読み込む
    const allContainersWithElements = await Promise.all(
      allContainers.value.map((c) => containerService.loadContainer(c.id)),
    );
    const errContainer = allContainersWithElements.find((res) => !res.ok);
    if (errContainer !== void 0) return toApiResponse(errContainer, 'DOC_LIST_FAILED');

    // Resultをunwrapしてファイル要素を抽出
    const containers = allContainersWithElements.filter((res) => res.ok).map((res) => res.value);
    const elements = containers.flatMap((c) => c.elements).filter((e) => e !== void 0);

    return toApiResponse(Success(elements));
  }

  /**
   * 文書を取得
   */
  async getDocument(file: ContainerElement): Promise<ApiResponse<Document>> {
    if (file.type !== 'File')
      return toApiResponse(
        Failure(new Error('Container element is not a file')),
        'INVALID_DOCUMENT',
      );
    const doc = await containerService.loadDocument(file);
    return toApiResponse(doc, 'INVALID_DOCUMENT');
  }

  /**
   * 文書を新規登録
   */
  async createDocument(
    title: string,
    filePath: string,
    fileName: string,
    pageCount: number,
    fileSize: number,
    description?: string,
    genre?: string,
  ): Promise<ApiResponse<Document>> {
    const doc = await containerService.
  }

  /**
   * 文書を更新
   */
  async updateDocument(
    id: string,
    updates: Partial<DocumentMetadata>,
  ): Promise<ApiResponse<DocumentMetadata | null>> {
    try {
      const doc = await documentService.updateDocument(id, updates);
      return {
        success: true,
        data: doc,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 文書を削除
   */
  async deleteDocument(id: string): Promise<ApiResponse<boolean>> {
    try {
      const result = await documentService.deleteDocument(id);
      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
        timestamp: new Date(),
      };
    }
  }

  // ============ アノテーション操作 ============

  /**
   * 文書別アノテーションを取得
   */
  async getAnnotationsByDocument(documentId: string): Promise<ApiResponse<Annotation[]>> {
    try {
      const annotations = await annotationService.getAnnotationByDocument(documentId);
      return {
        success: true,
        data: annotations,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get annotations',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 文書別アノテーションを保存
   */
  async saveAnnotationsByDocument(
    documentId: string,
    annotations: Annotation[],
  ): Promise<ApiResponse<void>> {
    try {
      await annotationService.saveAnnotationsByDocument(documentId, annotations);
      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save annotations',
        timestamp: new Date(),
      };
    }
  }

  // ============ 設定操作 ============

  /**
   * 設定を取得
   */
  async getSettings(): Promise<ApiResponse<AppSettings>> {
    const settings = await getSettings();
    return toApiResponse(settings, 'FAILED_LOAD_SETTINGS');
  }

  /**
   * 設定を保存
   */
  async saveSettings<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ): Promise<ApiResponse<void>> {
    const saveRes = await saveSettings(key, value);
    return toApiResponse(saveRes, 'FAILED_SAVE_SETTINGS');
  }
}

// グローバルAPIインスタンス
const backendApi = new BackendApi();

/**
 * フロントエンドから利用するためのAPI参照
 * Vue コンポーネント内で: const api = useBackendApi()
 */
export function useBackendApi() {
  return backendApi;
}

// グローバル登録用（オプション）
export default backendApi;

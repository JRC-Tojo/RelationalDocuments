import type { DocumentMetadata, Annotation, AppSettings, ApiResponse } from '../models/schemas';
import { documentService, annotationService, settingsService } from '../services/documentService';

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
    try {
      const settings = await settingsService.getSettings();
      if (!settings?.initialized) {
        await settingsService.initializeDefaultSettings();
      }
      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
        timestamp: new Date(),
      };
    }
  }

  // ============ 文書操作 ============

  /**
   * 全文書を取得
   */
  async getAllDocuments(): Promise<ApiResponse<DocumentMetadata[]>> {
    try {
      const documents = await documentService.getAllDocuments();
      return {
        success: true,
        data: documents,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get documents',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 文書を取得
   */
  async getDocument(id: string): Promise<ApiResponse<DocumentMetadata | null>> {
    try {
      const doc = await documentService.getDocument(id);
      return {
        success: true,
        data: doc,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document',
        timestamp: new Date(),
      };
    }
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
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      const doc = await documentService.createDocument(
        title,
        filePath,
        fileName,
        pageCount,
        fileSize,
        description,
        genre,
      );
      return {
        success: true,
        data: doc,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document',
        timestamp: new Date(),
      };
    }
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

  /**
   * アノテーション同士をリンク
   */
  async linkAnnotations(sourceId: string, targetId: string): Promise<ApiResponse<void>> {
    try {
      await annotationService.linkAnnotations(sourceId, targetId);
      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link annotations',
        timestamp: new Date(),
      };
    }
  }

  // ============ 設定操作 ============

  /**
   * 設定を取得
   */
  async getSettings(): Promise<ApiResponse<AppSettings | null>> {
    try {
      const settings = await settingsService.getSettings();
      return {
        success: true,
        data: settings,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 設定を保存
   */
  async saveSettings(settings: AppSettings): Promise<ApiResponse<void>> {
    try {
      await settingsService.saveSettings(settings);
      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings',
        timestamp: new Date(),
      };
    }
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

import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { localStorageRepository } from '../repositories/localStorageRepository';
import type { DocumentMetadata, AppSettings, Annotation } from '../models/schemas';

/**
 * 文書管理サービス
 * 文書のCRUD操作とメタデータ管理を担当
 */
class DocumentService {
  private documents = ref<DocumentMetadata[]>([]);

  /**
   * 全文書を取得
   */
  async getAllDocuments(): Promise<DocumentMetadata[]> {
    this.documents.value = await localStorageRepository.getAllDocuments();
    return this.documents.value;
  }

  /**
   * IDで文書を取得
   */
  async getDocument(id: string): Promise<DocumentMetadata | null> {
    return await localStorageRepository.getDocument(id);
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
  ): Promise<DocumentMetadata> {
    const newDoc: DocumentMetadata = {
      id: uuidv4(),
      title,
      filePath,
      fileName,
      pageCount,
      fileSize,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      updatedAt: new Date(),
      description: description || '',
      genre: genre || '',
      tags: [],
      annotationIds: [],
    };

    await localStorageRepository.saveDocument(newDoc);
    await this.getAllDocuments();

    return newDoc;
  }

  /**
   * 文書を更新
   */
  async updateDocument(
    id: string,
    updates: Partial<DocumentMetadata>,
  ): Promise<DocumentMetadata | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const updated: DocumentMetadata = {
      ...doc,
      ...updates,
      updatedAt: new Date(),
    };

    await localStorageRepository.saveDocument(updated);
    await this.getAllDocuments();

    return updated;
  }

  /**
   * 文書を削除
   */
  async deleteDocument(id: string): Promise<boolean> {
    // マークアップも一緒に削除
    const annotations = await localStorageRepository.getAnnotationsByDocument(id);
    for (const annotation of annotations) {
      await localStorageRepository.deleteAnnotation(annotation.id);
    }

    await localStorageRepository.deleteDocument(id);
    await this.getAllDocuments();
    return true;
  }
}

/**
 * マークアップ管理サービス
 * マーカーのCRUD操作と関連性管理を担当
 */
class AnnotationService {
  private annotations = ref<Annotation[]>([]);

  /**
   * 文書別マークアップを取得
   */
  async getAnnotationByDocument(documentId: string): Promise<Annotation[]> {
    return await localStorageRepository.getAnnotationsByDocument(documentId);
  }

  /**
   * 文書別マークアップを保存
   */
  async saveAnnotationsByDocument(documentId: string, annotations: Annotation[]): Promise<void> {
    await localStorageRepository.saveAnnotationsByDocument(documentId, annotations);
  }

  /**
   * マークアップ同士をリンク
   */
  async linkAnnotations(sourceId: string, targetId: string): Promise<void> {
    console.log(`MOCK: LINKED ANNOTATIONS (${sourceId} <---> ${targetId})`)
    return Promise.resolve()
  }
}

/**
 * アプリケーション設定サービス
 */
class SettingsService {
  /**
   * 設定を取得
   */
  async getSettings(): Promise<AppSettings | null> {
    return await localStorageRepository.getSettings();
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
    };

    await this.saveSettings(defaultSettings);
    return defaultSettings;
  }
}

// シングルトンインスタンスをエクスポート
export const documentService = new DocumentService();
export const annotationService = new AnnotationService();
export const settingsService = new SettingsService();

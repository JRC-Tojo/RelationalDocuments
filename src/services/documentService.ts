import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { localStorageRepository } from '../repositorys/localStorageRepository';
import type {
  DocumentMetadata,
  DocumentMarkup,
  DocumentRevision,
  MarkupBlock,
  ComplianceRule,
  AppSettings,
} from '../models/schemas';

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
      markupIds: [],
    };

    await localStorageRepository.saveDocument(newDoc);
    await this.getAllDocuments();

    // 改訂履歴を自動作成
    const revision: DocumentRevision = {
      id: uuidv4(),
      documentId: newDoc.id,
      revisionNumber: 1,
      changedAt: new Date(),
      changeDescription: '初期登録',
      changedPages: [],
    };
    await localStorageRepository.saveRevision(revision);

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

    // 更新時に改訂履歴を追加
    const revisions = await localStorageRepository.getRevisionsByDocument(id);
    const nextRevisionNumber = Math.max(...revisions.map((r) => r.revisionNumber), 0) + 1;

    const revision: DocumentRevision = {
      id: uuidv4(),
      documentId: id,
      revisionNumber: nextRevisionNumber,
      changedAt: new Date(),
      changeDescription: updates.description || '更新',
      changedPages: [],
      previousVersionId: revisions[0]?.id,
    };
    await localStorageRepository.saveRevision(revision);

    return updated;
  }

  /**
   * 文書を削除
   */
  async deleteDocument(id: string): Promise<boolean> {
    // マークアップも一緒に削除
    const markups = await localStorageRepository.getMarkupsByDocument(id);
    for (const markup of markups) {
      await localStorageRepository.deleteMarkup(markup.id);
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
class MarkupService {
  private markups = ref<DocumentMarkup[]>([]);

  /**
   * 全マークアップを取得
   */
  async getAllMarkups(): Promise<DocumentMarkup[]> {
    this.markups.value = await localStorageRepository.getAllMarkups();
    return this.markups.value;
  }

  /**
   * 文書別マークアップを取得
   */
  async getMarkupsByDocument(documentId: string): Promise<DocumentMarkup[]> {
    return await localStorageRepository.getMarkupsByDocument(documentId);
  }

  /**
   * マークアップを新規作成
   */
  async createMarkup(
    documentId: string,
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    content?: string,
    style?: 'highlight' | 'line' | 'box' | 'underline',
  ): Promise<DocumentMarkup> {
    const newMarkup: DocumentMarkup = {
      id: uuidv4(),
      documentId,
      pageNumber,
      x,
      y,
      width,
      height,
      color,
      content: content || '',
      style: style || 'highlight',
      opacity: 0.3,
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedMarkupIds: [],
      tags: [],
      relatedDocumentIds: [],
    };

    await localStorageRepository.saveMarkup(newMarkup);
    await this.getAllMarkups();
    return newMarkup;
  }

  /**
   * マークアップを更新
   */
  async updateMarkup(id: string, updates: Partial<DocumentMarkup>): Promise<DocumentMarkup | null> {
    const allMarkups = await this.getAllMarkups();
    const markup = allMarkups.find((m) => m.id === id);
    if (!markup) return null;

    const updated: DocumentMarkup = {
      ...markup,
      ...updates,
      updatedAt: new Date(),
    };

    await localStorageRepository.saveMarkup(updated);
    await this.getAllMarkups();
    return updated;
  }

  /**
   * マークアップを削除
   */
  async deleteMarkup(id: string): Promise<boolean> {
    await localStorageRepository.deleteMarkup(id);
    await this.getAllMarkups();
    return true;
  }

  /**
   * マークアップ同士をリンク
   */
  async linkMarkups(sourceId: string, targetId: string): Promise<void> {
    const allMarkups = await this.getAllMarkups();
    const source = allMarkups.find((m) => m.id === sourceId);
    const target = allMarkups.find((m) => m.id === targetId);

    if (!source || !target) throw new Error('Markup not found');

    const updatedSource: DocumentMarkup = {
      ...source,
      linkedMarkupIds: [...(source.linkedMarkupIds || []), targetId],
      updatedAt: new Date(),
    };

    const updatedTarget: DocumentMarkup = {
      ...target,
      linkedMarkupIds: [...(target.linkedMarkupIds || []), sourceId],
      updatedAt: new Date(),
    };

    await localStorageRepository.saveMarkup(updatedSource);
    await localStorageRepository.saveMarkup(updatedTarget);
    await this.getAllMarkups();
  }
}

/**
 * 改訂履歴サービス
 * 文書の変更履歴を管理
 */
class RevisionService {
  /**
   * 文書の改訂履歴を取得
   */
  async getDocumentRevisions(documentId: string): Promise<DocumentRevision[]> {
    return await localStorageRepository.getRevisionsByDocument(documentId);
  }

  /**
   * マークアップブロックを作成
   */
  async createMarkupBlock(
    markupId: string,
    title: string,
    content: string,
    genre?: string,
  ): Promise<MarkupBlock> {
    const block: MarkupBlock = {
      id: uuidv4(),
      markupId,
      title,
      content,
      genre: genre || '',
      revisionIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await localStorageRepository.saveMarkupBlock(block);
    return block;
  }

  /**
   * 整合性ルールを作成
   */
  async createComplianceRule(
    name: string,
    type: 'exact_match' | 'formula' | 'condition_check',
    sourceMarkupIds: string[],
    targetMarkupId: string,
    ruleExpression: string,
    description?: string,
  ): Promise<ComplianceRule> {
    const rule: ComplianceRule = {
      id: uuidv4(),
      name,
      description: description || '',
      type,
      sourceMarkupIds,
      targetMarkupId,
      ruleExpression,
      createdAt: new Date(),
    };

    await localStorageRepository.saveComplianceRule(rule);
    return rule;
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
export const markupService = new MarkupService();
export const revisionService = new RevisionService();
export const settingsService = new SettingsService();

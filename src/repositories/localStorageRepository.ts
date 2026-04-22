import { ref } from 'vue';
import type {
  DocumentMetadata,
  Annotation,
  DocumentRevision,
  DocumentFolder,
  AppSettings,
  MarkupBlock,
  ComplianceRule,
} from '../models/schemas';

/**
 * ローカルストレージリポジトリ
 * IndexedDB とメモリ上のストレージを組み合わせてデータを管理
 */
class LocalStorageRepository {
  private dbName = 'RelationalDocumentsDB';
  private documentStore = 'documents';
  private markupStore = 'markups';
  private revisionStore = 'revisions';
  private folderStore = 'folders';
  private settingsStore = 'settings';
  private blockStore = 'markupBlocks';
  private ruleStore = 'complianceRules';

  private db: IDBDatabase | null = null;
  private isInitialized = ref(false);

  /**
   * IndexedDB の初期化
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('IndexedDB initialization failed');
        reject(new Error(request.error?.message || 'IndexedDB initialization failed'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // ストアの作成
        if (!db.objectStoreNames.contains(this.documentStore)) {
          db.createObjectStore(this.documentStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.markupStore)) {
          db.createObjectStore(this.markupStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.revisionStore)) {
          db.createObjectStore(this.revisionStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.folderStore)) {
          db.createObjectStore(this.folderStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.settingsStore)) {
          db.createObjectStore(this.settingsStore, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(this.blockStore)) {
          db.createObjectStore(this.blockStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.ruleStore)) {
          db.createObjectStore(this.ruleStore, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized.value = true;
        resolve();
      };
    });
  }

  /**
   * ドキュメント全件取得
   */
  async getAllDocuments(): Promise<DocumentMetadata[]> {
    if (!this.db) await this.initialize();
    return new Promise<DocumentMetadata[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.documentStore], 'readonly');
      const store = transaction.objectStore(this.documentStore);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to get all documents'));
    });
  }

  /**
   * ドキュメント取得
   */
  async getDocument(id: string): Promise<DocumentMetadata | null> {
    if (!this.db) await this.initialize();
    return new Promise<DocumentMetadata | null>((resolve, reject) => {
      const transaction = this.db!.transaction([this.documentStore], 'readonly');
      const store = transaction.objectStore(this.documentStore);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error(request.error?.message || 'Failed to get document'));
    });
  }

  /**
   * ドキュメント保存
   */
  async saveDocument(doc: DocumentMetadata): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.documentStore], 'readwrite');
      const store = transaction.objectStore(this.documentStore);
      const request = store.put(doc);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save document'));
    });
  }

  /**
   * ドキュメント削除
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.documentStore], 'readwrite');
      const store = transaction.objectStore(this.documentStore);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to delete document'));
    });
  }

  /**
   * マークアップ全件取得
   */
  async getAllMarkups(): Promise<Annotation[]> {
    if (!this.db) await this.initialize();
    return new Promise<Annotation[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.markupStore], 'readonly');
      const store = transaction.objectStore(this.markupStore);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to get all markups'));
    });
  }

  /**
   * ドキュメント別マークアップ取得
   */
  async getMarkupsByDocument(documentId: string): Promise<Annotation[]> {
    const allMarkups = await this.getAllMarkups();
    return allMarkups.filter((m) => m.documentId === documentId);
  }

  /**
   * マークアップ保存
   */
  async saveAnnotation(markup: Annotation): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.markupStore], 'readwrite');
      const store = transaction.objectStore(this.markupStore);
      const request = store.put(markup);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(request.error?.message || 'Failed to save markup'));
    });
  }

  /**
   * マークアップ削除
   */
  async deleteMarkup(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.markupStore], 'readwrite');
      const store = transaction.objectStore(this.markupStore);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to delete markup'));
    });
  }

  /**
   * 改訂履歴全件取得
   */
  async getAllRevisions(): Promise<DocumentRevision[]> {
    if (!this.db) await this.initialize();
    return new Promise<DocumentRevision[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.revisionStore], 'readonly');
      const store = transaction.objectStore(this.revisionStore);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to get all revisions'));
    });
  }

  /**
   * ドキュメント別改訂履歴取得
   */
  async getRevisionsByDocument(documentId: string): Promise<DocumentRevision[]> {
    const allRevisions = await this.getAllRevisions();
    return allRevisions
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => b.revisionNumber - a.revisionNumber);
  }

  /**
   * 改訂履歴保存
   */
  async saveRevision(revision: DocumentRevision): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.revisionStore], 'readwrite');
      const store = transaction.objectStore(this.revisionStore);
      const request = store.put(revision);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save revision'));
    });
  }

  /**
   * フォルダ全件取得
   */
  async getAllFolders(): Promise<DocumentFolder[]> {
    if (!this.db) await this.initialize();
    return new Promise<DocumentFolder[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.folderStore], 'readonly');
      const store = transaction.objectStore(this.folderStore);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to get all folders'));
    });
  }

  /**
   * フォルダ保存
   */
  async saveFolder(folder: DocumentFolder): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.folderStore], 'readwrite');
      const store = transaction.objectStore(this.folderStore);
      const request = store.put(folder);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(request.error?.message || 'Failed to save folder'));
    });
  }

  /**
   * 設定取得
   */
  async getSettings(): Promise<AppSettings | null> {
    if (!this.db) await this.initialize();
    return new Promise<AppSettings | null>((resolve, reject) => {
      const transaction = this.db!.transaction([this.settingsStore], 'readonly');
      const store = transaction.objectStore(this.settingsStore);
      const request = store.get('app_settings');

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error(request.error?.message || 'Failed to get settings'));
    });
  }

  /**
   * 設定保存
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.settingsStore], 'readwrite');
      const store = transaction.objectStore(this.settingsStore);
      const request = store.put({ key: 'app_settings', ...settings });

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save settings'));
    });
  }

  /**
   * マークアップブロック保存
   */
  async saveMarkupBlock(block: MarkupBlock): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.blockStore], 'readwrite');
      const store = transaction.objectStore(this.blockStore);
      const request = store.put(block);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save markup block'));
    });
  }

  /**
   * 整合性ルール保存
   */
  async saveComplianceRule(rule: ComplianceRule): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.ruleStore], 'readwrite');
      const store = transaction.objectStore(this.ruleStore);
      const request = store.put(rule);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save compliance rule'));
    });
  }

  /**
   * クリア（テスト用）
   */
  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    const stores = [
      this.documentStore,
      this.markupStore,
      this.revisionStore,
      this.folderStore,
      this.settingsStore,
      this.blockStore,
      this.ruleStore,
    ];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(request.error?.message || `Failed to clear ${storeName}`));
      });
    }
  }
}

export const localStorageRepository = new LocalStorageRepository();

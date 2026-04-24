import { ref } from 'vue';
import type { DocumentMetadata, Annotation, DocumentFolder, AppSettings } from '../models/schemas';

/**
 * ローカルストレージリポジトリ
 * IndexedDB とメモリ上のストレージを組み合わせてデータを管理
 */
class LocalStorageRepository {
  private dbName = 'RelationalDocumentsDB';
  private documentStore = 'documents';
  private annotationStore = 'annotations';
  private folderStore = 'folders';
  private settingsStore = 'settings';
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
        if (!db.objectStoreNames.contains(this.annotationStore)) {
          db.createObjectStore(this.annotationStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.folderStore)) {
          db.createObjectStore(this.folderStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.settingsStore)) {
          db.createObjectStore(this.settingsStore, { keyPath: 'key' });
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
   * ドキュメント別アノテーション取得
   */
  async getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
    if (!this.db) await this.initialize();
    return new Promise<Annotation[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.annotationStore], 'readonly');
      const store = transaction.objectStore(this.annotationStore);
      const request = store.get(documentId);

      request.onsuccess = () => {
        resolve(request.result?.annotations ?? []);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to get all annotations'));
    });
  }

  /**
   * アノテーション保存
   */
  async saveAnnotationsByDocument(documentId: string, annotations: Annotation[]): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.annotationStore], 'readwrite');
      const store = transaction.objectStore(this.annotationStore);
      const request = store.put(JSON.parse(JSON.stringify({ id: documentId, annotations })));

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to save annotation'));
    });
  }

  /**
   * アノテーション削除
   */
  async deleteAnnotationsByDocument(documentId: string): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.annotationStore], 'readwrite');
      const store = transaction.objectStore(this.annotationStore);
      const request = store.delete(documentId);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message || 'Failed to delete all annotations in document'));
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
   * クリア（テスト用）
   */
  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    const stores = [
      this.documentStore,
      this.annotationStore,
      this.folderStore,
      this.settingsStore,
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

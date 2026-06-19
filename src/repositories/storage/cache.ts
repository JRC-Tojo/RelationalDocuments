/**
 * ブラウザのキャッシュ（indexedDB）に文書を保存する
 */
import type { Result } from 'src/models/error/result';
import { Failure, Success } from 'src/models/error/result';
import { ref } from 'vue';
import type z from 'zod';

/**
 * ローカルストレージリポジトリ
 * IndexedDB とメモリ上のストレージを組み合わせてデータを管理
 */
const dbName = 'RelationalDocumentsDB';

let db: IDBDatabase | null = null;
const isInitialized = ref(false);

/**
 * IndexedDB の初期化
 */
export async function initialize(storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => {
      console.error('IndexedDB initialization failed');
      reject(new Error(request.error?.message || 'IndexedDB initialization failed'));
    };

    request.onupgradeneeded = (event) => {
      const tmpDb = (event.target as IDBOpenDBRequest).result;

      // ストアの作成
      if (!tmpDb.objectStoreNames.contains(storeName)) {
        tmpDb.createObjectStore(storeName, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      isInitialized.value = true;
      resolve();
    };
  });
}

/**
 * ストアの初期化が必要か確認する
 */
function isNeedInitialize(storeName: string) {
  return !db || !db.objectStoreNames.contains(storeName);
}

/**
 * ストアから値を取得する
 *
 * @param key 値を取得する対象のキー（指定しない場合はストア全体を返す）
 */
export async function getValue<T extends z.ZodType>(
  storeName: string,
  targetZodType: T,
  key?: string,
): Promise<Result<z.infer<T>>> {
  if (isNeedInitialize(storeName)) await initialize(storeName);
  return new Promise((resolve) => {
    const transaction = db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = key ? store.get(key) : store.getAll();

    request.onsuccess = () => {
      const parsed = targetZodType.safeParse(request.result);
      if (parsed.success) {
        resolve(Success(parsed.data));
      } else {
        resolve(Failure(parsed.error));
      }
    };
    request.onerror = () =>
      resolve(
        Failure(
          new Error(
            request.error?.message || `Failed to get an item (key=${key}) from ${storeName}`,
          ),
        ),
      );
  });
}

/**
 * ストアに値を登録する
 */
export async function setValue<T>(storeName: string, key: string, value: T): Promise<Result<void>> {
  if (isNeedInitialize(storeName)) await initialize(storeName);
  return new Promise((resolve) => {
    const transaction = db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(JSON.parse(JSON.stringify(value)), key);

    request.onsuccess = () => resolve(Success());
    request.onerror = () =>
      resolve(
        Failure(
          new Error(
            request.error?.message || `Failed to set an item (key=${key}) into ${storeName}`,
          ),
        ),
      );
  });
}

/**
 * 登録済みの値を削除する
 */
export async function deleteValue(storeName: string, key: string): Promise<Result<void>> {
  if (isNeedInitialize(storeName)) await initialize(storeName);
  return new Promise((resolve) => {
    const transaction = db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(Success());
    request.onerror = () =>
      resolve(
        Failure(
          new Error(
            request.error?.message || `Failed to delete an item (key=${key}) into ${storeName}`,
          ),
        ),
      );
  });
}

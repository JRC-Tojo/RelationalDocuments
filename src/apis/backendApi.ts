import { getSettings, initializeSettings, saveSettings } from 'src/settings/main';
import { toApiResponse, type ApiResponse } from 'src/models/error/api';
import { Failure, Success } from 'src/models/error/result';
import * as containerService from 'src/services/container/main';
import * as relationalService from 'src/services/relational/main';
import * as pdfRepo from 'src/repositories/document/pdf';
import type {
  Container,
  ContainerElement,
  ContainerElementFile,
  ContainerID,
  ContainerSkel,
  ContainerType,
} from 'src/models/container';
import type { AppSettings } from 'src/models/settings';
import type { DocumentSource } from 'src/models/document/common';
import type { AnnotationID, AnnotationStyle } from 'src/models/document/pdf';
import type { Relational } from 'src/models/relational/common';
import { type RelationalResponce, type RelationalRule } from 'src/models/relational/common';

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

  // ============ コンテナ操作 ============

  /**
   * コンテナ一覧を取得する
   */
  async getAllContainers(): Promise<ApiResponse<ContainerSkel[]>> {
    // 保存済みのコンテナ情報を取得
    const allContainers = await containerService.getAllContainers();
    return toApiResponse(allContainers, 'CONTAINERS_GET_FAILED');
  }

  /**
   * コンテナを作成する
   */
  async createContainer(
    type: ContainerType,
    name: string,
    path: string,
  ): Promise<ApiResponse<ContainerSkel>> {
    const createdContainer = await containerService.createContainer(type, name, path);
    return toApiResponse(createdContainer, 'CONTAINER_CREATE_FAILED');
  }

  /**
   * コンテナの中身（ファイル群）を読み取る
   */
  async loadContainer(id: ContainerID): Promise<ApiResponse<Container>> {
    const loadedContainers = await containerService.loadContainer(id);
    return toApiResponse(loadedContainers, 'CONTAINER_LOAD_FAILED');
  }

  // ============ 文書操作 ============

  /**
   * 全コンテナ要素を取得
   */
  async getAllElements(): Promise<ApiResponse<ContainerElement[]>> {
    // 保存済みのコンテナ情報を取得
    const allContainers = await containerService.getAllContainers();
    if (!allContainers.ok) return toApiResponse(allContainers, 'CONTAINER_LOAD_FAILED');

    // TODO: 将来的には「コンテナ取得」と「コンテナ読み込み」は分離するが、現状はフロントエンドに媚びた実装
    // コンテナの要素をすべて読み込む
    const allContainersWithElements = await Promise.all(
      allContainers.value.map((c) => containerService.loadContainer(c.id)),
    );
    const errContainer = allContainersWithElements.find((res) => !res.ok);
    if (errContainer !== void 0) return toApiResponse(errContainer, 'DOC_LIST_FAILED');

    // Resultをunwrapしてファイル要素を抽出
    const containers = allContainersWithElements.filter((res) => res.ok).map((res) => res.value);
    const elements = containers
      .flatMap((c) => Object.values(c.elements ?? {}))
      .filter((e) => e !== void 0);

    return toApiResponse(Success(elements));
  }

  /**
   * 文書を取得
   */
  async getDocumentSource(file: ContainerElement): Promise<ApiResponse<DocumentSource>> {
    if (file.type !== 'File')
      return toApiResponse(
        Failure(new Error('Container element is not a file')),
        'INVALID_DOCUMENT',
      );
    const docSrc = await containerService.loadFileAsDocumentSource(file);
    return toApiResponse(docSrc, 'INVALID_DOCUMENT');
  }

  /**
   * 文書を新規登録
   */
  async saveFile(
    cId: ContainerID,
    filePath: string,
    srcData: DocumentSource,
  ): Promise<ApiResponse<ContainerElementFile>> {
    const file = await containerService.createFile(cId, filePath, srcData);
    return toApiResponse(file, 'DOC_SAVE_FAILED');
  }

  /**
   * 文書を削除
   */
  async deleteFile(cId: ContainerID, file: ContainerElementFile): Promise<ApiResponse<void>> {
    const deleteRes = await containerService.deleteFile(cId, file);
    return toApiResponse(deleteRes, 'DOC_DELETE_FAILED');
  }

  /**
   * パスのリネーム
   */
  async renamePath(
    elem: ContainerElement,
    newPath: string,
  ): Promise<ApiResponse<ContainerElement>> {
    // 新規パスに更新したElementを返す
    // TODO: 実データのファイルパスの更新と関係性データに記載のパス情報を両方更新する
    const renameRes = await containerService.renamePath(elem, newPath);
    if (!renameRes.ok) return toApiResponse(renameRes, 'PATH_RENAME_FAILED');
    const relRes = await relationalService.renamePath(elem, newPath);
    if (!relRes.ok) return toApiResponse(relRes, 'PATH_RENAME_FAILED');
    return toApiResponse(renameRes, 'PATH_RENAME_FAILED');
  }

  // ============ アノテーション操作 ============

  /**
   * 文書別アノテーションを取得
   */
  async getAnnotationsBySource(docSrc: DocumentSource): Promise<ApiResponse<AnnotationStyle[]>> {
    const annots = await pdfRepo.extractAnnotationsFromPdf(docSrc);
    return toApiResponse(annots, 'DOC_ANNOT_LOAD_FAILED');
  }

  /**
   * 文書別アノテーションを保存
   */
  async packAnnotationsInSource(
    docSrc: DocumentSource,
    annotations: AnnotationStyle[],
  ): Promise<ApiResponse<DocumentSource>> {
    const packedSrc = await pdfRepo.embedAnnotationsIntoPdf(docSrc, annotations);
    return toApiResponse(packedSrc, 'DOC_ANNOT_EMBED_FAILED');
  }

  // ============ 関係性操作 ============

  /**
   * 指定したアノテーションに紐づく関係性を取得する
   */
  async loadRelational(annotID: AnnotationID): Promise<ApiResponse<Relational[]>> {
    const res = await relationalService.loadRelationals(annotID)
    return toApiResponse(res, 'RELATIONAL_LOAD_FAILED')
  }

  /**
   * 指定した関係性を検証する
   */
  async checkRelationals(relational: Relational): Promise<ApiResponse<RelationalResponce>> {
    const res = await relationalService.checkRelational(relational);
    return toApiResponse(res, 'RELATIONAL_CHECK_FAILED');
  }

  /**
   * 関係性を登録する
   *
   * - 新規登録の場合
   * - 既存の登録内容を更新する場合
   */
  async registRelationals(
    sourceAnnotID: AnnotationID,
    targetAnnotIDs: AnnotationID[],
    rules: RelationalRule[],
  ): Promise<ApiResponse<RelationalResponce>> {}

  /**
   * 関係性を削除する
   */
  async removeRelationals(sourceAnnotID: AnnotationID): Promise<ApiResponse<void>> {}

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

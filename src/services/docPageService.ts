

/**
 * 文書ページの状態を管理して必要な機能を提供するサービス
 */
export class DocPageService {
  pointStatus: 'hand' | 'select' = 'hand'

  getDocumentTools() {
    // TODO: 外部コードからのツール追加もここで集約して最終的なリストを返す

    // TODO: 現状はサンプルのためデータを直接生成して返す。
    // 実際には別コードにツール定義を種別ごとに分割するべき

    return {

    }
  }
}
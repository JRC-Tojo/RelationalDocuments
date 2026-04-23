import { v4 as uuidv4 } from 'uuid';
import { useBackendApi } from '../apis/backendApi';
import { localStorageRepository } from '../repositories/localStorageRepository';

/**
 * アプリケーション初期化用ユーティリティ
 */
export async function initializeApp() {
  const api = useBackendApi();

  // IndexedDB の初期化
  await localStorageRepository.initialize();

  // アプリの初期化
  await api.initialize();

  // 初期データの確認
  const docsResponse = await api.getAllDocuments();
  console.log('初期化完了。登録済みドキュメント数:', docsResponse.data?.length || 0);
}

/**
 * デモ用のサンプルデータを作成
 */
export async function createDemoData() {
  const api = useBackendApi();

  const sampleDocs = [
    {
      title: 'システム要件定義書',
      genre: '設計書',
      description: 'システム全体の要件を定義したドキュメント。プロジェクトの基本方針を記載。',
      pageCount: 24,
    },
    {
      title: 'API仕様書 v2.1',
      genre: '仕様書',
      description: 'REST APIの詳細な仕様。エンドポイント、リクエスト/レスポンス形式を定義。',
      pageCount: 156,
    },
    {
      title: 'セキュリティ対応ガイドライン',
      genre: 'ガイドライン',
      description: 'セキュリティ対応に関する基本的なガイドライン。',
      pageCount: 48,
    },
    {
      title: 'データベース設計書',
      genre: '設計書',
      description: 'データベースのスキーマ定義とテーブル関連性図。',
      pageCount: 67,
    },
    {
      title: '本番環境運用マニュアル',
      genre: 'マニュアル',
      description: '本番環境での運用手順、トラブルシューティング方法を記載。',
      pageCount: 95,
    },
    {
      title: 'テスト計画書',
      genre: '計画書',
      description: 'テスト戦略、テストケース一覧、テストスケジュール。',
      pageCount: 38,
    },
  ];

  console.log('デモデータを作成中...');

  for (const doc of sampleDocs) {
    const response = await api.createDocument(
      doc.title,
      new URL('/src/assets/sampleDocs/sampleArticle.pdf', import.meta.url).href,
      doc.title,
      doc.pageCount,
      Math.floor(Math.random() * 10000000) + 100000,
      doc.description,
      doc.genre,
    );

    if (response.success && response.data) {
      console.log(`✓ "${doc.title}" を作成しました`);

      // 各ドキュメントに複数のマークアップを追加
      const annotationCount = Math.floor(Math.random() * 3) + 2;
      const colors: string[] = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

      for (let i = 0; i < annotationCount; i++) {
        const pageNum = Math.floor(Math.random() * Math.min(doc.pageCount, 5)) + 1;
        const colorIdx = Math.floor(Math.random() * colors.length);
        const color: string = colors[colorIdx] || '#FFD700';

        await api.saveAnnotationsByDocument(response.data.id, [
          {
            id: uuidv4(),
            documentId: response.data.id,
            pageNumber: pageNum,
            x: Math.random() * 500,
            y: Math.random() * 600,
            width: 150,
            height: 80,
            color: color,
            opacity: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            linkedAnnotationIds: [],
            tags: [],
            relatedDocumentIds: [],
            type: 'box',
            strokeWidth: 0,
          },
        ]);
      }
    }
  }

  console.log('デモデータの作成が完了しました！');
}

import { v4 as uuidv4 } from 'uuid';
import { useBackendApi } from '../apis/backendApi';
import { DocumentSource } from 'src/models/document/common';
import { AnnotationID, type AnnotationStyle } from 'src/models/document/pdf';
import { arrayBufferToBase64 } from './binary/base64';

/**
 * アプリケーション初期化用ユーティリティ
 */
export async function initializeApp() {
  const api = useBackendApi();

  // アプリの初期化
  await api.initialize();
}

/**
 * デモ用のサンプルデータを作成
 */
export async function createDemoData() {
  const api = useBackendApi();

  const sampleDocs = [
    { title: 'システム要件定義書' },
    { title: 'API仕様書 v2.1' },
    { title: 'セキュリティ対応ガイドライン' },
    { title: 'データベース設計書' },
    { title: '本番環境運用マニュアル' },
    { title: 'テスト計画書' },
  ];

  // デモデータ用のコンテナを作成
  const targetContainer = await api.createContainer('cache', 'DEMO CONTAINER', '.');
  if (!targetContainer.ok) {
    console.error('Failed to create demo container');
    console.log(targetContainer);
    return;
  }

  // コンテナ内部を読み込み
  const loadedContainer = await api.loadContainer(targetContainer.data.id);
  if (!loadedContainer.ok) return;

  // タイトルは違うが内容は同じドキュメントを生成するため、読み込みデータは１つだけ
  const targetURL = new URL('../assets/sampleDocs/sampleArticle.pdf', import.meta.url).href;
  const bufferedSrc = await fetch(targetURL).then((res) => res.arrayBuffer());
  const docSrc = DocumentSource.parse(await arrayBufferToBase64(bufferedSrc));

  for (const doc of sampleDocs) {
    const genedAnnots = generateRandomAnnots();
    const packedSrc = await api.packAnnotationsInSource(docSrc, genedAnnots);
    if (!packedSrc.ok) {
      console.error('Failed to pack annotations');
      console.log(packedSrc);
      return;
    }

    const response = await api.saveFile(
      loadedContainer.data.id,
      `./${doc.title}.pdf`,
      packedSrc.data,
    );
    if (!response.ok) {
      console.error(`Failed to save new document (${doc.title})`);
      console.log(response);
      return;
    }
  }
}

/**
 * ランダムにアノテーションを生成する
 */
function generateRandomAnnots(): AnnotationStyle[] {
  const annotationCount = 3;
  const colors: string[] = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  const annots: AnnotationStyle[] = [];
  for (let i = 0; i < annotationCount; i++) {
    const colorIdx = Math.floor(Math.random() * colors.length);
    const color: string = colors[colorIdx] || '#FFD700';

    annots.push({
      id: AnnotationID.parse(uuidv4()),
      pageNumber: 1,
      x: Math.random() * 500,
      y: Math.random() * 600,
      width: 150,
      height: 80,
      color: color,
      strokeWidth: 0,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      comment: {},
      type: 'box',
    });
  }

  return annots;
}

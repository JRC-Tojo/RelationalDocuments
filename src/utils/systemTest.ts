/**
 * システムテストスクリプト
 * フロントエンド統合型バックエンドのテスト
 */
import { useBackendApi } from '../apis/backendApi';

async function runTests() {
  console.log('=== RelationalDocuments System Test ===\n');

  const api = useBackendApi();

  try {
    // 1. 初期化テスト
    console.log('1. Testing initialization...');
    const initResponse = await api.initialize();
    console.log('✓ Initialization:', initResponse.success ? 'PASS' : 'FAIL');

    // 2. 文書作成テスト
    console.log('\n2. Testing document creation...');
    const docResponse = await api.createDocument(
      'Test Document',
      '/test/path',
      'test.pdf',
      10,
      1024000,
      'This is a test document',
      'Test Genre',
    );
    console.log('✓ Document creation:', docResponse.success ? 'PASS' : 'FAIL');
    const testDocId = docResponse.data?.id;

    // 3. 全文書取得テスト
    console.log('\n3. Testing get all documents...');
    const docsResponse = await api.getAllDocuments();
    console.log('✓ Get all documents:', docsResponse.success ? 'PASS' : 'FAIL');
    console.log(`  Total documents: ${docsResponse.data?.length || 0}`);

    // 4. マークアップ作成テスト
    if (testDocId) {
      console.log('\n4. Testing markup creation...');
      const markupResponse = await api.createMarkup(
        testDocId,
        1,
        10,
        20,
        100,
        50,
        '#FFD700',
        'Test Markup',
        'highlight',
      );
      console.log('✓ Markup creation:', markupResponse.success ? 'PASS' : 'FAIL');
      const testMarkupId = markupResponse.data?.id;

      // 5. マークアップ取得テスト
      console.log('\n5. Testing get markups by document...');
      const markupsResponse = await api.getMarkupsByDocument(testDocId);
      console.log('✓ Get markups:', markupsResponse.success ? 'PASS' : 'FAIL');
      console.log(`  Total markups: ${markupsResponse.data?.length || 0}`);

      // 6. マークアップ更新テスト
      if (testMarkupId) {
        console.log('\n6. Testing markup update...');
        const updateResponse = await api.updateMarkup(testMarkupId, {
          content: 'Updated Markup',
        });
        console.log('✓ Markup update:', updateResponse.success ? 'PASS' : 'FAIL');
      }

      // 7. 改訂履歴テスト
      console.log('\n7. Testing document revisions...');
      const revisionsResponse = await api.getDocumentRevisions(testDocId);
      console.log('✓ Get revisions:', revisionsResponse.success ? 'PASS' : 'FAIL');
      console.log(`  Total revisions: ${revisionsResponse.data?.length || 0}`);
    }

    // 8. 設定テスト
    console.log('\n8. Testing settings...');
    const settingsResponse = await api.getSettings();
    console.log('✓ Get settings:', settingsResponse.success ? 'PASS' : 'FAIL');

    // 9. 設定保存テスト
    console.log('\n9. Testing settings save...');
    const savingResponse = await api.saveSettings({
      darkMode: true,
      viewMode: 'list2',
      sortBy: 'name',
      initialized: true,
    });
    console.log('✓ Save settings:', savingResponse.success ? 'PASS' : 'FAIL');

    console.log('\n=== All tests completed ===');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

// エクスポート用
export { runTests };

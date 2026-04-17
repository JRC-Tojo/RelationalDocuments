import { boot } from 'quasar/wrappers';
import { initializeApp } from 'src/utils/appInitializer';

export default boot(async () => {
  // アプリケーションの初期化
  await initializeApp();
  console.log('アプリケーション初期化完了');
});

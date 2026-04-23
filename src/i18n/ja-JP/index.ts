export default {
  // ページタイトル
  title: {
    documents: 'ドキュメント一覧',
    viewer: 'ドキュメント表示',
    settings: '設定',
  },

  // 共通ボタン
  button: {
    add: '追加',
    save: '保存',
    delete: '削除',
    cancel: 'キャンセル',
    edit: '編集',
    close: '閉じる',
    upload: 'アップロード',
    refresh: '更新',
    back: '戻る',
    next: '次へ',
    previous: '前へ',
  },

  // ドキュメント関連
  document: {
    title: 'ドキュメント',
    name: 'ドキュメント名',
    uploadedAt: 'アップロード日時',
    updatedAt: '最終更新日時',
    pages: 'ページ',
    fileSize: 'ファイルサイズ',
    genre: 'ジャンル',
    description: '説明',
    tags: 'タグ',
    noDocuments: 'ドキュメントがありません',
    createNew: '新規ドキュメント',
    deleteConfirm: 'このドキュメントを削除しますか？',
  },

  // ビューモード
  viewMode: {
    rich: 'リッチ表示',
    list1: 'リスト表示（広）',
    list2: 'リスト表示（狭）',
  },

  // ソート
  sort: {
    byName: 'ドキュメント名でソート',
    byUpdatedAt: '更新日時でソート',
    byGenre: 'ジャンルでソート',
  },

  // メッセージ
  message: {
    success: '成功しました',
    error: 'エラーが発生しました',
    loading: '読み込み中...',
    saving: '保存中...',
    creatingDocument: 'ドキュメントを作成中...',
    deletingDocument: 'ドキュメントを削除中...',
    updatingDocument: 'ドキュメントを更新中...',
  },

  // PDF ビューア
  pdf: {
    zoomIn: 'ズームイン',
    zoomOut: 'ズームアウト',
    pageNumber: 'ページ',
    of: '/',
    fitPage: 'ページに合わせる',
    fitWidth: '幅に合わせる',
    singlePage: '1ページ表示',
    twoPage: '2ページ表示',
  },

  // 検索
  search: {
    placeholder: '検索...',
    noResults: '結果がありません',
  },

  // 設定
  settings: {
    title: '設定',
    darkMode: 'ダークモード',
    viewMode: '表示モード',
    sortBy: 'ソート',
    language: '言語',
    save: '設定を保存',
  },

  // エラーメッセージ
  error: {
    documentNotFound: 'ドキュメントが見つかりません',
    failedToLoadDocument: 'ドキュメントの読み込みに失敗しました',
    failedToCreateDocument: 'ドキュメント作成に失敗しました',
    failedToDeleteDocument: 'ドキュメント削除に失敗しました',
    failedToUpdateDocument: 'ドキュメント更新に失敗しました',
  },

  // PDF エディタ関連
  pdfEditor: {
    title: 'PDFエディタ',
    viewMode: '表示モード',
    singlePage: '単一ページ',
    continuous: '連続表示',
    twoPages: '見開き表示',
    color: '色',
    page: 'ページ',
    thumbnails: 'サムネイル',
    bookmarks: 'ブックマーク',
    annotations: 'アノテーション',
    addBookmark: 'ブックマークを追加',
    bookmarkTitle: 'ブックマークタイトルを入力してください:',
    noBookmarks: 'ブックマークはありません',
    noAnnotations: 'アノテーションはありません',
    highlight: 'ハイライト',
    line: '直線',
    box: 'ボックス',
    circle: '円',
    image: '画像',
  },
};

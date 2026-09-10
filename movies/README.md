# movies/ — アプリ操作紹介動画の撮影スクリプト

Playwrightでkumihimoの実際の操作を自動再生しながら、キャプション・強調ズーム・疑似カーソルなどの
演出を重ねて録画するツール一式。`src/`・`e2e/`とは完全に独立しており、アプリ本体のテスト規約には従わない。

## 使い方

```
# 1. 依存関係とサブモジュール（PLUGIN_SDK / PLUGIN_STORE）を用意
bun install
git submodule update --init

# 2. dev サーバーを起動
bun run dev

# 3. 録画（Windows環境なのでNode.js経由。Bunではない）
npx playwright test -c movies/playwright.movies.config.ts movies/record.spec.ts
```

動画は `movies/output/*.webm` に出力される。特別なセットアップ（フォルダアクセス許可など）は不要。

## コンテナ作成（実PDF）の仕組み

ローカルフォルダのコンテナ作成は、実際にはブラウザ標準のOSネイティブ「フォルダーの参照」
ダイアログ（File System Access API）を使う。これはPlaywrightから自動操作できず、
Playwrightの動画録画もページ内描画しか記録しないためダイアログ自体は映らない
（試しにheaded Chromiumを起動しようとしたが、物理デスクトップ/RDPの実機でも
GPU・グラフィックドライバ絡みで起動直後にクラッシュし、いずれにせよ使えなかった）。

そこで`scenarios/01-createContainer.ts`では:

1. **画面演出として**、＋→「ローカルフォルダ」タブ→「フォルダを選択」を実際にクリックして見せる
   （headlessでは`showDirectoryPicker`自体が存在しないため、クリックしても何も起きずすぐ閉じる）
2. **実際のデータ投入**は、開発ビルド限定の内部フック`window.__kumihimoTest.api`
   （実体は本物の`BackendApi`、`src/boot/testHook.ts`。既存の`e2e/support/seed.ts`と同じ経路）
   経由で、実際の業務PDFのバイト列をそのまま`cache`（インメモリ）型コンテナへ書き込む
   （`lib/seedContainer.ts`）

画面に表示されるフォルダ構成・PDFの中身は実物（サンプルコンテナ/計算書・図面/）と同一。
「実際のフォルダを選ぶとこうなる」という体裁を保ちつつ、自動化不可能なOSダイアログを回避している。

## 構成

- `config.ts` — 撮影対象フォルダ・色・フォント・タイミングなどの設定値
- `director/` — キャプション・ショートカットバッジ・疑似カーソル・強調ズームの演出レイヤー
  - `browserSide.ts` — ページに注入される実体（`window.__director`）
  - `director.ts` — Node側から呼ぶ非同期ラッパー
- `lib/` — 共通ヘルパー
  - `smoothMouse.ts` — 滑らかなマウス移動・クリック・ドラッグ描画
  - `textLayer.ts` — PDFテキストレイヤーから実際の文字列の座標を取得する
  - `appActions.ts` — アイコンボタン/タブ/メニュー項目の特定
  - `seedContainer.ts` — 実PDFを`cache`コンテナへ投入する（上記参照）
  - `waits.ts` — 単純なsleep
- `scenarios/` — 撮影シナリオ本体。`index.ts`の配列を編集するだけで追加・並び替えができる
- `record.spec.ts` — 撮影のエントリポイント（Playwright test）
- `playwright.movies.config.ts` — 撮影専用のPlaywright設定（`e2e/`のCI設定とは別）

## シナリオを追加・変更する

1. `scenarios/xx-yourScenario.ts`を作り、`Scenario`型（`scenarios/types.ts`）に沿って実装する
2. `director.caption(title, desc)`でタイトル+説明のキャプションを画面左下に表示する。
   **自動では消えない**ため、その操作が続く間はずっと表示され続ける。一つの操作を終えて
   次のキャプションに切り替える直前には、必ず`await director.settle()`を呼んで明示的に消すこと
   （キャプションが変わったことが視聴者にはっきり伝わる空白ができる）。
   `director.shortcut(text)`はショートカットキー/マウス操作の合図をキャプションのすぐ上に一瞬表示する
3. クリックは`mouse.clickLocator(locator)`、ドラッグ描画は`mouse.dragCreateAnnotation(from, to)`を使う
   （生の`locator.click()`は疑似カーソルが追従せず、動きも滑らかにならないので使わないこと）
4. 強調したい範囲があれば`director.zoomTo(rect)` → `director.zoomReset()`で挟む。
   **ズーム中はクリック等の実操作を行わないこと**（CSS transformで見た目だけ拡大しているため、
   実際のクリック座標とズレる）
5. `scenarios/index.ts`の配列に追加する

## 既知の制約

- PDF・アノテーションはKonva/Canvas描画のためDOM要素を持たない。`lib/textLayer.ts`で
  透明テキストレイヤー（`.text-layer__item`）から実際の文字列の座標を取得して操作する
- data-testidが付いているのはメインツールバー（`annotation-*`, `relational-define-*`,
  `view-mode-menu`など）と`RelationalDefineButtons`のみ。それ以外はQuasarのアイコン名・
  ラベル文言で特定する
- `lib/seedContainer.ts`が使う`window.__kumihimoTest`は開発ビルド限定（`import.meta.env.DEV`）。
  `quasar build`した本番ビルドでは存在しないため、撮影は必ず`bun run dev`のdevサーバーに対して行う

/**
 * シナリオ06: 図面内で計算書の結果を参照している箇所を四角形で囲い、
 * 該当する計算書の部分に線を引いて「リンク」関係性をつける。仕上げに図面側を実際のズーム機能で拡大する。
 *
 * 一般図.pdfの側面図には主桁の断面仕様「H 700×350×12×22 (SM400)」が明記されており、
 * これは計算書.pdf 1ページ目の断面諸量に書かれた仕様と完全に一致する。
 *
 * 【座標について】一般図.pdfは検証の結果pdf.js `getTextContent()`が0件＝埋め込みテキストが
 * 無い（アウトライン化されている）ことが判明したため、`lib/textLayer.ts`によるテキスト検索が
 * 使えない。両ドキュメントで統一的に扱うため、また実際にこの固定座標で動作確認済みのため、
 * 両方とも撮影時の固定条件（`config.ts`のVIEWPORT=1600x900・ズーム100%・1ページ目、
 * かつシナリオ02で一般図が右上（ur）ペインへ移動済み・シナリオ04で計算書が連続表示モードに
 * 切り替わった直後）で実測した座標を直接使用する。
 *
 * レビュー指摘を受けて実測し直した結果、旧`GIRDER_LABEL_RECT`（x:645）は実は右上ペイン
 * （一般図、x:800前後〜）ではなく左ペイン（計算書）側にかかっており、四角形が一般図ではなく
 * 計算書側の全く無関係な位置に描かれてしまっていたことが判明した（＝レビューで指摘された
 * 「四角形がどこにも見えない」の根本原因）。実際にスクリーンショットで一般図側のラベル位置を
 * 実測し直して座標を修正している。
 *
 * 撮影条件（解像度やPDF自体、ペイン配置）を変える場合はこの座標も併せて測り直すこと
 */
import { TIMING } from '../config';
import { sleep, withTimeout } from '../lib/waits';
import type { Scenario } from './types';

// 一般図.pdf 1ページ目、右上（ur）ペイン内（1600x900, 100%）:
// 側面図の主桁断面ラベル「H 700x350x12x22(SM400)」を囲む矩形（実測値）
const GIRDER_LABEL_RECT = { x: 1245, y: 436, width: 100, height: 16 };

// 計算書.pdf 1ページ目、左（ul）ペイン内（1600x900, 100%、連続表示モード）:
// 断面諸量の「H- 700 X 350 X 12 X 22 ( SM400 )」の実測テキスト矩形（実測値）
const CALC_SPEC_RECT = { x: 589, y: 427, width: 189, height: 11 };

export const relationalLink: Scenario = {
  id: '06-relationalLink',
  async run({ page, director, mouse }) {
    await director.caption(
      '関係性を作る：リンク',
      '図面の根拠になっている計算書の箇所を「リンク」でつなぎます。',
    );

    // 右上ペイン（一般図）にフォーカスを移してから、鋼材仕様のラベルを四角形で囲む
    const drawingTab = page.locator('.tab-item').filter({ hasText: '一般図' }).first();
    await mouse.clickLocator(drawingTab);

    await mouse.clickLocator(page.locator('[data-testid="annotation-box"]'));
    // ドラッグ操作自体が録画に映るよう、合図を出してからゆっくり描画する
    await director.shortcut('ドラッグして四角形を描画');
    await mouse.dragCreateAnnotation(
      { x: GIRDER_LABEL_RECT.x, y: GIRDER_LABEL_RECT.y },
      { x: GIRDER_LABEL_RECT.x + GIRDER_LABEL_RECT.width, y: GIRDER_LABEL_RECT.y + GIRDER_LABEL_RECT.height },
    );
    // 確定直後の見た目を視聴者が確認できるよう、次の操作へ移る前に少し間を置く
    await sleep(800);
    await director.settle();

    await mouse.clickLocator(page.locator('[data-testid="relational-define-link"]'));
    await director.caption(
      '対応する計算書の記述へ',
      '同じ断面仕様が書かれている計算書の行を選ぶと、リンクが確定します。',
    );

    // 左ペイン（計算書）にフォーカスを移し、対応する断面仕様に線を引いてペアを確定させる
    const calcTab = page.locator('.tab-item').filter({ hasText: '計算書' }).first();
    await mouse.clickLocator(calcTab);

    await mouse.clickLocator(page.locator('[data-testid="annotation-line"]'));
    await director.shortcut('ドラッグして線を描画');
    // 下線ではなくテキストの高さの中央を通す。これは見た目の分かりやすさに加えて、
    // アプリ本体の値抽出（`extractTextByAnnot`）が文字の中心点と実形状（線幅の半分）の
    // 近接判定で行われるため、細い既定の線幅（2px）だとテキストの真下や少し離れた位置に
    // 引くと値がまったく抽出できず、関係性の検証値が空文字列のままになってしまうことが
    // 実機検証で判明したことによる（詳細は05-relationalEqual.tsのdrawUnderline参照）
    const centerY = CALC_SPEC_RECT.y + CALC_SPEC_RECT.height / 2;
    await mouse.dragCreateAnnotation(
      { x: CALC_SPEC_RECT.x, y: centerY },
      { x: CALC_SPEC_RECT.x + CALC_SPEC_RECT.width, y: centerY },
    );
    await sleep(800);
    await director.settle();

    // 直前に作成したリンクのアノテーションが選択されている状態のはず。Spaceキーで関係性
    // ダイアログを開き、事情を知らない人でも図面の根拠をすぐに参照できることを強調する。
    // このダイアログ操作は撮影環境依存でハングすることがあるため（05-relationalEqual.ts参照）、
    // テスト全体を巻き込まないよう時間制限を掛け、失敗しても例外を外に投げない
    try {
      await withTimeout(
        (async () => {
          await director.shortcut('Space');
          await page.keyboard.press('Space');

          const peekDialog = page.locator('.q-dialog').filter({ hasText: '関係性の一覧' }).first();
          await peekDialog.waitFor({ state: 'visible', timeout: 5000 });
          await director.settle();

          await director.caption(
            'リンク先をすぐに参照できる',
            '事情を知らない人でも、Spaceキーで図面の根拠になっている計算書の記述をすぐに確認できます。',
          );
          await sleep(1500);

          await page.keyboard.press('Escape');
          await sleep(300);
        })(),
        10000,
        'リンク関係性ダイアログのデモ',
      );
    } catch (e) {
      console.warn(`movies/scenarios/06: 関係性ダイアログのデモをスキップしました（${(e as Error).message}）`);
      await page.keyboard.press('Escape').catch(() => {});
    }
    await director.settle();

    // 図面側に戻り、実際のCtrl+ホイールズーム機能で囲った箇所を拡大する
    // （CSS transformによる見た目だけの`director.zoomTo`ではなく、本体の実ズーム機能を使う）
    await mouse.clickLocator(drawingTab);
    await director.caption('図面の該当箇所を拡大', 'この鋼材仕様が計算書の結果と一致しています。');

    const centerX = GIRDER_LABEL_RECT.x + GIRDER_LABEL_RECT.width / 2;
    const centerYGirder = GIRDER_LABEL_RECT.y + GIRDER_LABEL_RECT.height / 2;
    await director.shortcut('Ctrl + ホイール');
    // 100% -> 133 -> 167 -> 200 -> 300%の4段階だけズームインする
    await mouse.ctrlWheelZoom(centerX, centerYGirder, 4, true);
    await sleep(TIMING.zoomHold);
    // 元の100%まで4段階でズームアウトして戻す
    await mouse.ctrlWheelZoom(centerX, centerYGirder, 4, false);
    await sleep(400);
    await director.settle();
  },
};

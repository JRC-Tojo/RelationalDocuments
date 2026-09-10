/**
 * シナリオ05: 計算書内での数値の参照を検証し、「等しい」関係性をつける（関係性モードの紹介を兼ねる）
 *
 * 計算書.pdf 1ページ目には、設計作用力の表にある値がそのまま下の応力度計算式でも
 * 再利用されている箇所が実在する（例: 軸力 N=82.00）。表の中の値と数式の中の値それぞれに
 * 直線マーカーを引き、「等しい」関係性としてつなぐ（1組目）。
 *
 * 2組目では、実際に効果を持つ変換式の例として、1ページ目の断面仕様
 * 「H-700×350×12×22」に書かれたフランジ幅 350（mm）と、2ページ目のボルト配置図に実在する
 * 継手プレート幅の内訳「5 | 340 | 5」の 340（mm、両端の縁端距離5mmずつを差し引いた値。
 * 5 + 340 + 5 = 350）を使う。350と340は生の値としては一致しないため、この時点ではまず
 * 不一致（NG）と判定される。そこで緩和ルール編集ダイアログに変換式「x + 10」を設定すると
 * 340 + 10 = 350 となり、保存した瞬間に一致（OK）へ切り替わる様子を実演する。
 * 併せて、関係性種別を切り替えるプルダウン（等しい⇔リンク）の操作も一度見せる。
 *
 * 座標は`lib/textLayer.ts`で計算書.pdfの埋め込みテキストレイヤーから実測する
 * （計算書.pdfにはOCRで文字レイヤーが付与済み。一般図.pdf側は未対応のため
 * `scenarios/06-relationalLink.ts`では別途固定座標を使っている）
 *
 * 【下線の位置についての重要な注意】実機検証の結果、下線（直線アノテーション）とテキストの
 * 位置関係は見た目だけの問題ではないことが判明した。アプリ本体の値抽出処理
 * （`src/repositories/document/pdf.ts`の`extractTextByAnnot`）は、PDFの各文字の中心点が
 * アノテーションの実形状（`ANNOTATION_GEOMETRY[type].containsPoint`、直線の場合は線幅の
 * 半分だけの近接判定）に含まれるかどうかで抽出対象を決めている。既定の線スタイルは
 * 線幅2px（`editorStore.ts`の`DEFAULT_ANNOTATION_STYLE`）と細く、許容範囲は上下1pxしかない。
 * そのため、レビュー指摘前の「テキストの下に3pxの余白を空けた位置」は見た目が不自然な
 * だけでなく、実際には値をまったく抽出できず（空文字列のまま）、関係性が常に
 * 「空文字列同士が一致している」という偽のOK判定になってしまっていた（実機で確認済み）。
 * この問題は、下線をテキストの高さの中央（`rect.y + rect.height / 2`）に重ねて引くことで
 * 解消する（見た目は下線というよりテキストに重なる強調線に近くなるが、実際に値を指し示す
 * という目的においては、離れた位置に線を引くよりも正確で分かりやすい）。
 */
import type { Page } from '@playwright/test';
import { findAllTextRects, scrollUntilTextFound } from '../lib/textLayer';
import { sleep, withTimeout } from '../lib/waits';
import { typeSlowly } from '../lib/slowType';
import type { SmoothMouse } from '../lib/smoothMouse';
import type { Scenario } from './types';

// 下線がテキストの本体からわずかにはみ出すよう左右に加える余白（px）。
// 見た目の分かりやすさに加え、対象テキストの横幅が15px未満だと`dragCreateAnnotation`の
// ドラッグ確定しきい値（15px）を満たせずアノテーションが生成されないことがあるための安全策でもある
// （継手プレート幅の「340」は横幅が11px程度しかなく、この余白が無いと再現性がなかった）
const UNDERLINE_PAD_X = 4;

async function drawUnderline(
  ctx: { page: Page; mouse: SmoothMouse },
  rect: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const { page, mouse } = ctx;
  await mouse.clickLocator(page.locator('[data-testid="annotation-line"]'));
  // テキストの高さの中央を通す（上部コメント参照。値抽出の近接判定を確実に満たすため）
  const y = rect.y + rect.height / 2;
  await mouse.dragCreateAnnotation(
    { x: rect.x - UNDERLINE_PAD_X, y },
    { x: rect.x + rect.width + UNDERLINE_PAD_X, y },
  );
  await sleep(300);
}

// 計算書ペイン内をスクロールする際のアンカー座標（ペイン内であればどこでもよい）
const CALC_PANE_SCROLL_ANCHOR = { x: 650, y: 500 };

export const relationalEqual: Scenario = {
  id: '05-relationalEqual',
  async run(ctx) {
    const { page, director, mouse } = ctx;

    await director.caption(
      '関係性を作る：等しい',
      '文書内で同じ値が再利用されている箇所を、直線マーカーでつないで検証します。',
    );

    // --- 1組目: 軸力 N = 82.00（表の値 ⇔ 引張フランジ応力度の式の中の値） ---
    const [axialTable, axialFormula] = await findAllTextRects(page, '82.00');
    if (!axialTable || !axialFormula) {
      throw new Error('movies/scenarios/05: 「82.00」の出現箇所が2箇所見つかりませんでした（PDFの表示状態を確認してください）');
    }
    await drawUnderline(ctx, axialTable);

    await mouse.clickLocator(page.locator('[data-testid="relational-define-equal"]'));
    await director.settle();
    await director.caption(
      '「等しい」で結ぶ',
      '起点を選んだら、次に選んだアノテーションと自動でペアになります。',
    );

    // 起点確定後、対になるアノテーションを新規描画すればその場でペアが確定する
    await drawUnderline(ctx, axialFormula);
    await sleep(600);
    await director.settle();

    // --- 2組目: 断面仕様のフランジ幅350（1ページ目）と、継手プレート幅の内訳340（2ページ目）。
    //     見た目上は異なる値だが、5+340+5=350という実在する関係があり、変換式のデモに使う ---
    await director.caption(
      '別ページの値とも検証できる',
      '1ページ目のフランジ幅「350」と、2ページ目のプレート幅内訳「340」を比べてみます。',
    );

    // 8箇所ある「350」のうち、断面仕様の行（H-700 X 350 X 12 X 22）にある2番目の出現を使う
    const flangeWidthCandidates = await findAllTextRects(page, '350');
    const flangeWidth = flangeWidthCandidates[1];
    if (!flangeWidth) {
      throw new Error('movies/scenarios/05: 断面仕様のフランジ幅「350」が見つかりませんでした');
    }
    await drawUnderline(ctx, flangeWidth);
    await mouse.clickLocator(page.locator('[data-testid="relational-define-equal"]'));
    await director.settle();

    // 継手プレート幅の内訳図「5 | 340 | 5」は2ページ目にあるため、計算書ペインをスクロールして探す
    await director.shortcut('スクロール');
    const plateWidth = await scrollUntilTextFound(page, '340', CALC_PANE_SCROLL_ANCHOR);
    await drawUnderline(ctx, plateWidth);
    await sleep(600);

    // 直前に作成した2組目のアノテーションが選択されている状態のはず。Spaceキーで関係性ダイアログを開く
    await director.shortcut('Space');
    await page.keyboard.press('Space');
    await director.settle();

    // このダイアログ操作は撮影環境によって原因不明のハングを起こすことがあるため、テスト全体の
    // タイムアウトを巻き込まないよう時間制限を掛け、失敗しても例外を外に投げない。
    // 実機検証で一連の操作（種別プルダウンの切り替え・変換式の保存によるNG→OKの反転）が
    // 正しく動作することは確認済みだが、それでも撮影環境依存の不具合に備えて保険を残す。
    // これはあくまで「変換式・種別変更のUIも見せられるとなお良い」という付加的な演出であり、
    // 失敗しても関係性の作成自体（このシナリオの本題）は既に完了している
    try {
      await withTimeout(
        (async () => {
          const peekDialog = page.locator('.q-dialog').filter({ hasText: '関係性の一覧' }).first();
          await peekDialog.waitFor({ state: 'visible', timeout: 5000 });

          await director.caption(
            '関係性の種別を切り替える',
            '「等しい」「リンク」はいつでもプルダウンから変更できます。',
          );

          // 種別プルダウンを実際に操作して見せる（等しい→リンク→等しいと一往復する）
          const ruleSelect = peekDialog.locator('.rule-select').first();
          await mouse.clickLocator(ruleSelect);
          await mouse.clickLocator(page.getByRole('option', { name: 'リンク', exact: true }));
          await sleep(500);
          await mouse.clickLocator(ruleSelect);
          await mouse.clickLocator(page.getByRole('option', { name: '等しい', exact: true }));
          await sleep(500);
          await director.settle();

          // 現在は生の値同士（350 と 340）が食い違っているため、NG（不一致）のはず。
          // 変換式を設定する前の状態を視聴者に見せる
          await director.caption(
            '現在は不一致（NG）',
            '350 と 340 は生の値のままでは一致しません。変換式で揃えます。',
          );
          await sleep(1000);

          // 実際に隣の種類選択コンボボックスと紛らわしく、アイコン名やaria-labelでの特定は
          // 誤爆した（実測ではボタンの実アクセシブルネームはツールチップ文言
          // 「緩和ルールを編集」だった）。役割(role)+名前で確実に特定する
          const tuneButton = peekDialog.getByRole('button', { name: '緩和ルールを編集' });
          await mouse.clickLocator(tuneButton);

          const formulaDialog = page.locator('.q-dialog').last();
          // このダイアログは自身（プレート幅340側）に適用する式の入力欄のみを持つ
          // （placeholderの実測値"x * 1.09"で確実に特定する）
          const formulaInput = formulaDialog.getByPlaceholder('x * 1.09');
          await formulaInput.waitFor({ state: 'visible', timeout: 5000 });
          // 検索デモ（07-search.ts）と同様、1文字ずつ実際に入力している様子を見せる
          // （`.fill()`だと瞬時に入力されてしまい、動画として伝わらない）
          // 340 + 10 = 350 として、もう一方の生の値（350）と一致させる
          await typeSlowly(page, formulaInput, 'x + 10');
          await director.settle();
          await director.caption(
            '変換式で単位・寸法を揃える',
            '両端の縁端距離5mmずつ（合計10mm）を足すと、フランジ幅350と一致します。',
          );
          await sleep(1200);

          const saveButton = formulaDialog.getByText('保存', { exact: true }).first();
          await mouse.clickLocator(saveButton);

          // 保存直後、検証が再実行されてOK（一致）に切り替わる様子を見せる
          await sleep(1500);

          // 「自身の値」欄に反映された変換式の計算結果（340 + 10 = 350）を強調ズームする
          const selfValueEl = peekDialog.locator('.self-value-text').first();
          const selfValueBox = await selfValueEl.boundingBox().catch(() => null);
          if (selfValueBox) {
            const valuePad = selfValueBox.height * 3;
            await director.zoomTo({
              x: selfValueBox.x - valuePad,
              y: selfValueBox.y - valuePad,
              width: selfValueBox.width + valuePad * 2,
              height: selfValueBox.height + valuePad * 2,
            });
            await sleep(1200);
            await director.zoomReset();
          }

          await page.keyboard.press('Escape');
          await sleep(300);
        })(),
        20000,
        '変換式・種別変更ダイアログのデモ',
      );
    } catch (e) {
      console.warn(`movies/scenarios/05: 変換式・種別変更ダイアログのデモをスキップしました（${(e as Error).message}）`);
      await page.keyboard.press('Escape').catch(() => {});
    }

    await director.settle();

    // 2ページ目までスクロールした状態のままだと、後続シナリオ（06）が想定する
    // 計算書1ページ目基準の固定座標と食い違ってしまうため、必ず先頭までスクロールを戻しておく
    await page.mouse.move(CALC_PANE_SCROLL_ANCHOR.x, CALC_PANE_SCROLL_ANCHOR.y);
    await page.mouse.wheel(0, -4000);
    await sleep(500);
  },
};

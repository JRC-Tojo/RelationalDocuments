import { describe, expect, it } from 'bun:test';
import {
  AnnotationID,
  ColorCode,
  type BoxAnnotationStyle,
  type LineAnnotationStyle,
} from 'src/models/document/pdf';
import { DEFAULT_RELATIONAL_VERIFICATION_STYLE } from 'src/models/relational/style';
import { hexToRgba } from 'src/utils/color/hexToRgba';
import {
  applyRelationalOverrideToStyle,
  getRelationalStyleOverride,
} from '../relationalStyleOverride';

const TEST_ID = AnnotationID.parse('11111111-1111-4111-8111-111111111111');

function buildBox(): BoxAnnotationStyle {
  return {
    id: TEST_ID,
    pageNumber: 1,
    x: 10,
    y: 10,
    color: ColorCode.parse('#0000ff'),
    strokeWidth: 3,
    strokeType: 'solid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comment: {},
    type: 'box',
    width: 50,
    height: 30,
    fillColor: ColorCode.parse('#00ff00'),
    fillOpacity: 0.9,
  };
}

function buildLine(): LineAnnotationStyle {
  return {
    id: TEST_ID,
    pageNumber: 1,
    x: 10,
    y: 10,
    color: ColorCode.parse('#0000ff'),
    strokeWidth: 3,
    strokeType: 'solid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comment: {},
    type: 'line',
    points: [0, 0, 10, 10],
  };
}

describe('getRelationalStyleOverride', () => {
  it('検証保留中（pending）は元のスタイルを使ってほしいのでundefinedを返す', () => {
    expect(
      getRelationalStyleOverride('pending', DEFAULT_RELATIONAL_VERIFICATION_STYLE),
    ).toBeUndefined();
  });

  it('関連なし（undefined）は元のスタイルを使ってほしいのでundefinedを返す', () => {
    expect(
      getRelationalStyleOverride(undefined, DEFAULT_RELATIONAL_VERIFICATION_STYLE),
    ).toBeUndefined();
  });

  it('okの場合、検証スタイルのok設定からstroke/strokeWidth/fillを組み立てる', () => {
    const okStyle = DEFAULT_RELATIONAL_VERIFICATION_STYLE.ok;
    expect(getRelationalStyleOverride('ok', DEFAULT_RELATIONAL_VERIFICATION_STYLE)).toEqual({
      stroke: okStyle.strokeColor,
      strokeWidth: okStyle.strokeWidth,
      fill: hexToRgba(okStyle.fillColor, okStyle.fillOpacity),
    });
  });

  it('ngの場合、検証スタイルのng設定からstroke/strokeWidth/fillを組み立てる', () => {
    const ngStyle = DEFAULT_RELATIONAL_VERIFICATION_STYLE.ng;
    expect(getRelationalStyleOverride('ng', DEFAULT_RELATIONAL_VERIFICATION_STYLE)).toEqual({
      stroke: ngStyle.strokeColor,
      strokeWidth: ngStyle.strokeWidth,
      fill: hexToRgba(ngStyle.fillColor, ngStyle.fillOpacity),
    });
  });

  it('errorの場合は専用の見た目を用意せず、ngと同じスタイルで警告表示する', () => {
    expect(getRelationalStyleOverride('error', DEFAULT_RELATIONAL_VERIFICATION_STYLE)).toEqual(
      getRelationalStyleOverride('ng', DEFAULT_RELATIONAL_VERIFICATION_STYLE),
    );
  });
});

describe('applyRelationalOverrideToStyle', () => {
  it('statusがpending/undefinedの場合は元のannotationをそのまま返す', () => {
    const box = buildBox();
    expect(
      applyRelationalOverrideToStyle(box, 'pending', DEFAULT_RELATIONAL_VERIFICATION_STYLE),
    ).toBe(box);
    expect(
      applyRelationalOverrideToStyle(box, undefined, DEFAULT_RELATIONAL_VERIFICATION_STYLE),
    ).toBe(box);
  });

  it('statusがokの場合、fillColorを持つ型はcolor/strokeWidth/fillColor/fillOpacityがすべて検証スタイルの値に置き換わる', () => {
    const box = buildBox();
    const result = applyRelationalOverrideToStyle(box, 'ok', DEFAULT_RELATIONAL_VERIFICATION_STYLE);
    const okStyle = DEFAULT_RELATIONAL_VERIFICATION_STYLE.ok;

    expect(result.color as string | undefined).toBe(okStyle.strokeColor);
    expect(result.strokeWidth).toBe(okStyle.strokeWidth);
    if (result.type !== 'box') throw new Error('expected box');
    expect(result.fillColor as string | undefined).toBe(okStyle.fillColor);
    expect(result.fillOpacity).toBe(okStyle.fillOpacity);
    // 元の座標・サイズ等は変更されない
    expect(result.x).toBe(box.x);
    expect(result.width).toBe(box.width);
  });

  it('statusがngの場合、fillColorを持たない型（line）はcolor/strokeWidthのみ上書きされる', () => {
    const line = buildLine();
    const result = applyRelationalOverrideToStyle(
      line,
      'ng',
      DEFAULT_RELATIONAL_VERIFICATION_STYLE,
    );
    const ngStyle = DEFAULT_RELATIONAL_VERIFICATION_STYLE.ng;

    expect(result.color as string | undefined).toBe(ngStyle.strokeColor);
    expect(result.strokeWidth).toBe(ngStyle.strokeWidth);
    expect('fillColor' in result).toBeFalse();
  });

  it('元のannotationに元々fillColorが未設定でも、statusがok/ngなら型が対応していればfillColorが付与される', () => {
    const box = buildBox();
    const noFillBox = { ...box, fillColor: undefined, fillOpacity: undefined };
    const result = applyRelationalOverrideToStyle(
      noFillBox,
      'ok',
      DEFAULT_RELATIONAL_VERIFICATION_STYLE,
    );
    if (result.type !== 'box') throw new Error('expected box');
    expect(result.fillColor as string | undefined).toBe(
      DEFAULT_RELATIONAL_VERIFICATION_STYLE.ok.fillColor,
    );
  });
});

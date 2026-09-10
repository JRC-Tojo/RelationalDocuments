import { describe, expect, it } from 'bun:test';
import { blendModeToComposite, blendModeToPdfBlendName } from '../blendMode';

describe('blendModeToComposite', () => {
  it('undefinedは"source-over"に変換する', () => {
    expect(blendModeToComposite(undefined)).toBe('source-over');
  });

  it('"normal"は"source-over"に変換する', () => {
    expect(blendModeToComposite('normal')).toBe('source-over');
  });

  it('"normal"以外はそのままCanvasの合成モード名として返す', () => {
    expect(blendModeToComposite('multiply')).toBe('multiply');
    expect(blendModeToComposite('color-dodge')).toBe('color-dodge');
  });
});

describe('blendModeToPdfBlendName', () => {
  it('undefinedは"Normal"に変換する', () => {
    expect(blendModeToPdfBlendName(undefined)).toBe('Normal');
  });

  it('"normal"は"Normal"に変換する', () => {
    expect(blendModeToPdfBlendName('normal')).toBe('Normal');
  });

  it('単語のケバブケース名をパスカルケースへ変換する', () => {
    expect(blendModeToPdfBlendName('multiply')).toBe('Multiply');
  });

  it('ハイフン区切りの複合語をパスカルケースへ変換する', () => {
    expect(blendModeToPdfBlendName('color-dodge')).toBe('ColorDodge');
    expect(blendModeToPdfBlendName('hard-light')).toBe('HardLight');
  });
});

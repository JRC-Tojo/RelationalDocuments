import { describe, expect, it } from 'bun:test';
import {
  buildConfigFileName,
  buildLegacyConfigFileName,
  getSourceBaseNameFromConfigFileName,
  isConfigFileName,
} from '../common';

/**
 * 文書設定ファイル（`.kcfg`サイドカー）の命名規則ヘルパーを検証する
 *
 * Issue #93対応：OS上のファイルエクスプローラでシステム固有ファイルを可能な限り
 * 非表示にするため、新形式は先頭にドットを付与する命名規則へ変更した。
 * 旧形式（先頭ドット無し）との後方互換のための判定・変換ロジックもあわせて検証する
 */
describe('buildConfigFileName（新形式・先頭ドット付き）', () => {
  it('ファイル名の先頭にドットを付与し、末尾に.kcfgを付与する', () => {
    expect(buildConfigFileName('report.pdf')).toBe('.report.pdf.kcfg');
  });

  it('拡張子を持たないファイル名にも適用できる', () => {
    expect(buildConfigFileName('README')).toBe('.README.kcfg');
  });
});

describe('buildLegacyConfigFileName（旧形式・先頭ドット無し、後方互換用）', () => {
  it('ファイル名の末尾にのみ.kcfgを付与する', () => {
    expect(buildLegacyConfigFileName('report.pdf')).toBe('report.pdf.kcfg');
  });
});

describe('isConfigFileName', () => {
  it('新形式（先頭ドット付き）の名前を設定ファイルと判定する', () => {
    expect(isConfigFileName('.report.pdf.kcfg')).toBeTrue();
  });

  it('旧形式（先頭ドット無し）の名前も設定ファイルと判定する', () => {
    expect(isConfigFileName('report.pdf.kcfg')).toBeTrue();
  });

  it('.kcfgで終わらない名前は設定ファイルと判定しない', () => {
    expect(isConfigFileName('report.pdf')).toBeFalse();
  });
});

describe('getSourceBaseNameFromConfigFileName', () => {
  it('新形式（先頭ドット付き）から元の文書ファイル名を復元する', () => {
    expect(getSourceBaseNameFromConfigFileName('.report.pdf.kcfg')).toBe('report.pdf');
  });

  it('旧形式（先頭ドット無し）から元の文書ファイル名を復元する', () => {
    expect(getSourceBaseNameFromConfigFileName('report.pdf.kcfg')).toBe('report.pdf');
  });

  it('拡張子を持たない元ファイル名にも対応する', () => {
    expect(getSourceBaseNameFromConfigFileName('.README.kcfg')).toBe('README');
  });

  it('新旧いずれの形式で構築しても同じ文書名へ復元できる（往復変換の整合性）', () => {
    const sourceName = 'archive.tar.pdf';
    expect(getSourceBaseNameFromConfigFileName(buildConfigFileName(sourceName))).toBe(sourceName);
    expect(getSourceBaseNameFromConfigFileName(buildLegacyConfigFileName(sourceName))).toBe(
      sourceName,
    );
  });
});

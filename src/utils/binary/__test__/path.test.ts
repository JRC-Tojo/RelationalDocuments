import { describe, test, expect } from 'bun:test';
import { Path } from '../path';

describe('Path', () => {
  test('path', () => {
    // パス操作のテスト
    expect(new Path('.').path).toBe('.');
    expect(new Path('./').path).toBe('.');
    expect(new Path('').path).toBe('.');

    expect(new Path('..').path).toBe('..');
    expect(new Path('../').path).toBe('..');

    expect(new Path('./').child('foo').path).toBe('foo');
    expect(new Path('./').child('foo/').path).toBe('foo');
    expect(new Path('./').child('/foo/').path).toBe('foo');

    expect(new Path('./').child('foo').path).toBe('foo');
    expect(new Path('./').child('/foo/').path).toBe('foo');

    expect(new Path('./').child('foo/bar').path).toBe(new Path('foo/bar').path);
    expect(new Path('./').child('foo\\bar').path).toBe(new Path('foo/bar').path);
    expect(new Path('./').child('foo', 'bar').path).toBe(new Path('foo/bar').path);
    expect(new Path('./').child('/foo/', '/bar/', '/buz/').path).toBe(new Path('foo/bar/buz').path);

    expect(new Path('foo').path).toBe('foo');
    expect(new Path('foo/').path).toBe('foo');

    expect(new Path('foo').child('bar').path).toBe(new Path('foo/bar').path);
    expect(new Path('foo/').child('/bar/').path).toBe(new Path('foo/bar').path);

    expect(new Path('foo/bar').parent().path).toBe(new Path('foo').path);
    expect(new Path('foo/bar').parent(2).path).toBe(new Path('').path);
  });

  test('file path', () => {
    const workPath = new Path('');
    const testdir = workPath.child('pathChecks');
    const file1 = testdir.child('file1.txt');

    // ファイル名
    expect(file1.basename()).toBe('file1.txt');
    expect(file1.stemname()).toBe('file1');
    expect(file1.extname()).toBe('.txt');

    // 相対パス
    expect(file1.relativeto(testdir).path).toBe('..');
  });
});

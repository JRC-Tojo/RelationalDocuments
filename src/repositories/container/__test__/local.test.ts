import { describe, test, expect } from 'bun:test';

/**
 * TODO: この実装はPathオブジェクトがファイル操作を実施する場合のテスト
 * 今回はPathオブジェクトの情報を基に各コンテナ操作コードが以下の処理を行うため、実装の修正が必要
 */

describe.skip('Local file operation', () => {
  test('creation', async () => {
    // ファイル操作のテスト
    const testdir = workPath.child('creations');

    // testdirの中身をリセット (正直これができてる時点でみたいな話はある)
    await testdir.remove();
    await testdir.mkdir();

    // ディレクトリの生成/削除
    const a = testdir.child('a');
    expect(a.exists()).toBe(false);
    await a.mkdir();
    // 存在するディレクトリを生成しても何も起こらない
    await a.mkdir();
    expect(a.exists()).toBe(true);
    await a.remove();
    // 存在しないディレクトリを削除しても何も起こらない
    await a.remove();
    expect(a.exists()).toBe(false);

    // ファイルの生成/削除
    await a.mkdir();
    const b = a.child('b');
    await b.writeText('hello');
    expect(await b.readText()).toBe('hello');
    await b.remove();
    expect(b.exists()).toBe(false);
    await a.remove();

    // ディレクトリの再帰的な作成/削除
    expect(a.exists()).toBe(false);
    await b.mkdir();
    expect(b.exists()).toBe(true);
    await a.remove();
    expect(a.exists()).toBe(false);

    // ensureDirはディレクトリが存在しない場合のみ作成する
    await a.ensureDir();
    expect(a.exists()).toBe(true);

    // emptyDirはディレクトリが空であることを保証する
    await a.child('sample.txt').writeText('hello');
    const aPaths1 = await a.iter();
    expect(isError(aPaths1)).toBe(false);
    if (!isError(aPaths1)) {
      const fileCount1 = aPaths1.length;
      expect(fileCount1).toBe(1);
    }
    await a.emptyDir();

    const aPaths2 = await a.iter();
    expect(isError(aPaths2)).toBe(false);
    if (!isError(aPaths2)) {
      const fileCount2 = aPaths2.length;
      expect(fileCount2).toBe(0);
    }
  });

  test('isDirectory', async () => {
    const testdir = workPath.child('isDirectory');
    await testdir.remove();

    // 存在しないディレクトリをチェックするとエラー
    const isDirectoryFailResult = await testdir.isDirectory();
    expect(isError(isDirectoryFailResult)).toBe(true);

    // ディレクトリを生成
    await testdir.mkdir();

    // 存在するディレクトリをチェックすると成功
    const isDirectorySuccessResult = await testdir.isDirectory();
    expect(isError(isDirectorySuccessResult)).toBe(false);
    expect(isDirectorySuccessResult).toBe(true);
  });

  test('rename', async () => {
    // ファイル操作のテスト
    const testdir = workPath.child('renames');
    await testdir.emptyDir();

    // リネーム（ファイル）
    const renameFile = testdir.child('renameFile.txt');
    // 存在しないファイルをリネームする場合はエラー
    const renameFailResult = await renameFile.rename(testdir.child('renameFile2.txt'));
    expect(isError(renameFailResult)).toBe(true);
    // 存在するファイルをリネームする場合は成功
    await renameFile.writeText('hello');
    const renameSuccessResult = await renameFile.rename(testdir.child('renameFile2.txt'));
    expect(isError(renameSuccessResult)).toBe(false);

    // リネーム後のファイルが存在することを確認
    expect(renameFile.exists()).toBe(false);
    expect(testdir.child('renameFile2.txt').exists()).toBe(true);

    // リネーム（ディレクトリ）
    const renameDir = testdir.child('renameDir');
    await renameDir.mkdir();
    await renameDir.rename(testdir.child('renameDir2'));
    expect(renameDir.exists()).toBe(false);
    expect(testdir.child('renameDir2').exists()).toBe(true);
  });

  test('file operations', async () => {
    const testdir = workPath.child('operations');
    await testdir.emptyDir();
    const sourceDir = testdir.child('source');
    await sourceDir.child('a.txt').writeText('a');
    await sourceDir.child('dir', 'b.txt').writeText('b');

    // check copy
    const copyTargetDir = testdir.child('copyTarget');
    const copyRes = await sourceDir.copyTo(copyTargetDir);
    expect(isError(copyRes)).toBe(false);
    expect(sourceDir.exists()).toBe(true);
    expect(copyTargetDir.child('a.txt').exists()).toBe(true);
    expect(copyTargetDir.child('dir', 'b.txt').exists()).toBe(true);

    // check move
    const moveTargetDir = testdir.child('moveTarget');
    const moveRes = await sourceDir.moveTo(moveTargetDir);
    expect(isError(moveRes)).toBe(false);
    expect(sourceDir.exists()).toBe(false);
    expect(moveTargetDir.child('a.txt').exists()).toBe(true);
    expect(moveTargetDir.child('dir', 'b.txt').exists()).toBe(true);
  });

  test('json files', async () => {
    const testdir = workPath.child('jsons');
    await testdir.emptyDir();
    const jsonFile = testdir.child('target.json');
    const sampleObj = {
      a: 1,
      b: '2',
      c: [3, 4, 5],
      d: { e: 6, f: 7 },
    };
    const ObjType = z.object({
      a: z.number(),
      b: z.string(),
      c: z.array(z.number()),
      d: z.object({ e: z.number(), f: z.number() }),
    });

    await jsonFile.writeJson(sampleObj);
    const readObj = await jsonFile.readJson(ObjType);
    expect(readObj).toEqual(sampleObj);
  });

  test('iterDir', async () => {
    const testdir = workPath.child('iterDirs');

    // ファイルの一覧表示
    const file1 = testdir.child('file1.txt');
    const file2 = testdir.child('file2.txt');
    await file1.writeText('hello');
    await file2.writeText('world');
    const allPaths = await testdir.iter();
    expect(isError(allPaths)).toBe(false);

    if (!isError(allPaths)) {
      const fileTxts = await Promise.all(allPaths.map((file) => file.readText()));
      expect(fileTxts).toEqual(['hello', 'world']);
    }
  });

  test('file path', async () => {
    const testdir = workPath.child('pathChecks');
    const file1 = testdir.child('file1.txt');

    // ファイル名
    expect(file1.basename()).toBe('file1.txt');
    expect(file1.stemname()).toBe('file1');
    expect(file1.extname()).toBe('.txt');

    // 相対パス
    expect(file1.relativeto(testdir).path).toBe('..');
  });

  test('exclusive control', async () => {
    // 検証対象のファイル
    const p1 = new Path('test1');
    // 別オブジェクトから同一のファイル（test1）にアクセスする状況を想定
    const p2 = new Path('test1');
    // 完全別ファイル
    const p3 = new Path('test2');
    const executionOrder: number[] = [];

    /** 指定時間`delay`にtest1のロック状態を確認する */
    const checkLock = async (delay: number) => {
      await sleep(delay);
      return p1.isLocked();
    };

    // Run two test() calls simultaneously
    const [result1, isLocked1, result2, isLocked2, result3] = await Promise.all([
      // run time is 100ms
      p1.test(100).then((val) => {
        executionOrder.push(1);
        return val;
      }),
      checkLock(50), // 50ms経過時点ではtest1が実行中のため，test1がロックされている
      // run time is 10ms
      p2.test(10).then((val) => {
        executionOrder.push(2);
        return val;
      }),
      // --> total run time is 110ms

      checkLock(200), // 200ms経過時点ではtest1が完了しているため，test1がロックされていない
      // other file
      p3.test(50).then((val) => {
        executionOrder.push(3);
        return val;
      }),
    ]);

    // Verify:
    // 1. Both calls return expected value (10)
    expect(result1).toBe(100);
    expect(result2).toBe(10);
    expect(result3).toBe(50);

    // 2. test1 is locked for 50ms, not locked for 200ms
    expect(isLocked1).toBe(true);
    expect(isLocked2).toBe(false);

    // 3. Execution order shows sequential processing (not parallel)
    // test1とtest2という別リソースに対する処理は並列に実行されるが，
    // test1同士という同じリソースに対する処理は直列に実行される
    // test1 |---------->(p1, 100ms) |->(p2, 10ms)
    // check       ^(50ms, Lock=true)                ^(200ms, Lock=false)
    // test2 |----->(p3, 50ms)
    expect(executionOrder).toEqual([3, 1, 2]);
  });
})

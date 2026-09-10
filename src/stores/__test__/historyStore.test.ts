import { describe, expect, it, beforeEach } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import { useHistoryStore, type HistoryCommand } from '../historyStore';
import type { ContainerID } from 'src/models/container';

const fileA = { containerID: '00000000-0000-4000-8000-0000000000c1' as ContainerID, path: '/a.pdf' };
const fileB = { containerID: '00000000-0000-4000-8000-0000000000c1' as ContainerID, path: '/b.pdf' };

function buildCommand(): HistoryCommand & { undoCalls: number; redoCalls: number } {
  const command = {
    undoCalls: 0,
    redoCalls: 0,
    undo(): void {
      command.undoCalls++;
    },
    redo(): void {
      command.redoCalls++;
    },
  };
  return command;
}

describe('historyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('canUndo / canRedo', () => {
    it('積んだ操作が無ければfalseを返す', () => {
      const store = useHistoryStore();
      expect(store.canUndo(fileA)).toBeFalse();
      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('pushした直後はcanUndoがtrue、canRedoはfalse', () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());

      expect(store.canUndo(fileA)).toBeTrue();
      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('他のタブの履歴には影響しない', () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());

      expect(store.canUndo(fileB)).toBeFalse();
    });
  });

  describe('push', () => {
    it('新しい操作を積むとredoStackがクリアされる', async () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());
      await store.undo(fileA);
      expect(store.canRedo(fileA)).toBeTrue();

      store.push(fileA, buildCommand());

      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('上限（100件）を超えると古い操作から破棄する', () => {
      const store = useHistoryStore();
      for (let i = 0; i < 101; i++) {
        store.push(fileA, buildCommand());
      }

      const bucket = store.ensureBucket(fileA);
      expect(bucket.undoStack).toHaveLength(100);
    });
  });

  describe('undo / redo', () => {
    it('undoでコマンドのundo()を呼び、redoStackへ積む', async () => {
      const store = useHistoryStore();
      const command = buildCommand();
      store.push(fileA, command);

      await store.undo(fileA);

      expect(command.undoCalls).toBe(1);
      expect(store.canUndo(fileA)).toBeFalse();
      expect(store.canRedo(fileA)).toBeTrue();
    });

    it('redoでコマンドのredo()を呼び、undoStackへ戻す', async () => {
      const store = useHistoryStore();
      const command = buildCommand();
      store.push(fileA, command);
      await store.undo(fileA);

      await store.redo(fileA);

      expect(command.redoCalls).toBe(1);
      expect(store.canUndo(fileA)).toBeTrue();
      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('積んだ操作が無いタブへのundoは何もしない', async () => {
      const store = useHistoryStore();
      await store.undo(fileA);

      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('undo()が失敗した場合はundoStackへ戻し、redoStackへは積まない', async () => {
      const store = useHistoryStore();
      const command: HistoryCommand = {
        undo: () => {
          throw new Error('undo failed');
        },
        redo: () => {},
      };
      store.push(fileA, command);

      await store.undo(fileA);

      expect(store.canUndo(fileA)).toBeTrue();
      expect(store.canRedo(fileA)).toBeFalse();
    });

    it('同一タブへの多重呼び出しはbusyKeysで無視する', async () => {
      const store = useHistoryStore();
      let resolveUndo: () => void = () => {};
      const command: HistoryCommand = {
        undo: () =>
          new Promise<void>((resolve) => {
            resolveUndo = resolve;
          }),
        redo: () => {},
      };
      store.push(fileA, command);

      const first = store.undo(fileA);
      expect(store.isBusy(fileA)).toBeTrue();
      const second = store.undo(fileA);

      resolveUndo();
      await Promise.all([first, second]);

      // 2回目の呼び出しはbusy中のため、undoStackへの積み戻しが1回しか起きない
      expect(store.canRedo(fileA)).toBeTrue();
      expect(store.isBusy(fileA)).toBeFalse();
    });
  });

  describe('clear', () => {
    it('指定タブの履歴を破棄する', () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());

      store.clear(fileA);

      expect(store.canUndo(fileA)).toBeFalse();
    });
  });

  describe('migrate', () => {
    it('旧パスの履歴を新パスへ移し替える', () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());

      store.migrate(fileA, fileB);

      expect(store.canUndo(fileA)).toBeFalse();
      expect(store.canUndo(fileB)).toBeTrue();
    });

    it('移行先に既にバケツがある場合は移し替えず、旧バケツを破棄するだけに留める', () => {
      const store = useHistoryStore();
      const oldCommand = buildCommand();
      const newCommand = buildCommand();
      store.push(fileA, oldCommand);
      store.push(fileB, newCommand);

      store.migrate(fileA, fileB);

      expect(store.canUndo(fileA)).toBeFalse();
      const bucket = store.ensureBucket(fileB);
      expect(bucket.undoStack).toEqual([newCommand]);
    });

    it('同一キーへの移行は何もしない', () => {
      const store = useHistoryStore();
      store.push(fileA, buildCommand());

      store.migrate(fileA, fileA);

      expect(store.canUndo(fileA)).toBeTrue();
    });
  });
});

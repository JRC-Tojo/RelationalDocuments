/**
 * 動画に収録するシナリオの一覧と順序。
 * 追加・並び替えはこの配列を編集するだけでよい（各シナリオの実装には手を入れる必要がない）。
 */
import type { Scenario } from './types';
import { createContainer } from './01-createContainer';
import { openDocumentsAndSplitPane } from './02-openDocumentsAndSplitPane';
import { autoSave } from './03-autoSave';
import { viewModes } from './04-viewModes';
import { relationalEqual } from './05-relationalEqual';
import { relationalLink } from './06-relationalLink';
import { search } from './07-search';
import { plugin } from './08-plugin';

export const scenarios: Scenario[] = [
  createContainer,
  openDocumentsAndSplitPane,
  autoSave,
  viewModes,
  relationalEqual,
  relationalLink,
  search,
  plugin,
];

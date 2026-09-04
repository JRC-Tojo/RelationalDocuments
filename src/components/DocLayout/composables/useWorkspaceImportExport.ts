/**
 * 「最近使用したコンテナ」一覧のJSONインポート／エクスポートに関するロジックをまとめたコンポーザブル
 *
 * `useAnnotationPresetsImport.ts`と同じ考え方で、バックエンドAPIに依存するインポート処理を
 * 単体テスト対象のパース・検証ロジックから分離する
 */
import { WorkspaceExport } from 'src/models/workspaceExport';
import type { RecentContainerEntry } from 'src/models/container';
import { useBackendApi } from 'src/apis/backendApi';

export type ParseImportedWorkspaceResult =
  | { success: true; recentContainers: RecentContainerEntry[] }
  | { success: false; reason: 'parse' | 'validation' };

/**
 * インポートしたJSONテキストを「最近使用したコンテナ」一覧として検証・パースする
 *
 * JSON構文自体が不正な場合と、構文は正しいがスキーマに一致しない場合とを`reason`で
 * 区別できるようにし、呼び出し側でそれぞれ異なるメッセージを表示できるようにする
 */
export function parseImportedWorkspace(jsonText: string): ParseImportedWorkspaceResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch {
    return { success: false, reason: 'parse' };
  }

  const parsed = WorkspaceExport.safeParse(parsedJson);
  if (!parsed.success) return { success: false, reason: 'validation' };
  return { success: true, recentContainers: parsed.data.recentContainers };
}

/**
 * インポートした「最近使用したコンテナ」一覧を、現在の環境の一覧へ追加する
 *
 * フォルダへの実アクセス権は引き継げないため、ここでは一覧への追加のみを行う。実際の
 * フォルダとの結び付け直しは、一覧からエントリを選んだ際の再接続フロー
 * （`NewContainerDialog.vue`）に委ねる
 * @returns 保存に成功したかどうか
 */
export async function applyImportedWorkspace(
  recentContainers: RecentContainerEntry[],
): Promise<boolean> {
  const api = useBackendApi();
  const res = await api.importRecentContainers(recentContainers);
  return res.ok;
}

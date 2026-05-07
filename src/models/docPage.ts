
/** 文書ページに表示する各ツール */
export type IDocTool =
  | { icon: string; onClicked: () => void }
  | { icon: string; menu: IDocTool[] };
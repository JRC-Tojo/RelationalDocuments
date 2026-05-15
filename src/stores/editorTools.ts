import type { AnnotationTool, AnnotationType, IDocTool } from 'src/models/docPage';
import { useEditorStore } from './editorStore';
import { useBackendApi } from 'src/apis/backendApi';
import { useI18n } from 'vue-i18n';

function annotationCnf2Tool(ann: AnnotationTool): IDocTool {
  const editorStore = useEditorStore();

  let icon = 'question_mark';
  switch (ann.style.type) {
    case 'box':
      icon = 'check_box_outline_blank';
      break;
    case 'line':
      icon = 'horizontal_rule';
      break;
    case 'circle':
      icon = 'circle';
      break;
    case 'text':
      icon = 'font_download';
  }

  return {
    id: ann.id,
    icon: icon,
    label: ann.name,
    isActive: () => {
      // オブジェクトの中身も含めて等しいことを確認するためにstringifyする
      const strStoreStyle = JSON.stringify(editorStore.currentAnnotationStyle)
      const strOriginStyle = JSON.stringify(ann.style)
      return strStoreStyle === strOriginStyle
    },
    onClicked: () => {
      editorStore.currentTools = ann.style.type;
      editorStore.currentAnnotationStyle = ann.style;
    },
  };
}

async function callAnnotationTools(): Promise<IDocTool[]> {
  const { t } = useI18n();
  const editorStore = useEditorStore();
  const api = useBackendApi();

  const settings = await api.getSettings();
  if (!settings.success) return [];

  const registSubTools = (toolType: AnnotationType) => {
    const docTools = settings.data.tools.annotations
      .filter((ann) => ann.style.type === toolType)
      .map((ann) => annotationCnf2Tool(ann));
    editorStore.subTools = docTools;
  };

  const tools: IDocTool[] = [
    {
      id: 'annotation-line',
      icon: 'edit',
      label: t('pdfEditor.line'),
      isActive: () => false,
      onClicked: () => registSubTools('line'),
    },
    {
      id: 'annotation-box',
      icon: 'crop_square',
      label: t('pdfEditor.box'),
      isActive: () => false,
      onClicked: () => registSubTools('box'),
    },
    {
      id: 'annotation-circle',
      icon: 'circle',
      label: t('pdfEditor.circle'),
      isActive: () => false,
      onClicked: () => registSubTools('circle'),
    },
    {
      id: 'toggle-annotation-visibility',
      icon: 'visibility',
      label: t('pdfEditor.annotationToggle'),
      isActive: () => editorStore.visibleAnnotations,
      onClicked: () => {
        editorStore.visibleAnnotations = !editorStore.visibleAnnotations;
      },
    },
  ];

  return tools;
}

function callPointerTools(): IDocTool[] {
  const editorStore = useEditorStore();

  const tools: IDocTool[] = [
    {
      id: 'toggle-left-drawer',
      icon: 'menu',
      label: 'Left Drawer',
      isActive: () => false,
      onClicked: () => {
        editorStore.leftDrawerModel = !editorStore.leftDrawerModel;
      },
    },
    {
      id: 'hand-mode',
      icon: 'pan_tool',
      label: 'Hand Mode',
      isActive: () => {
        return editorStore.currentTools === 'hand'
      },
      onClicked: () => {
        editorStore.currentTools = 'hand';
      },
    },
    {
      id: 'select-mode',
      icon: 'touch_app',
      label: 'Select Mode',
      isActive: () => {
        return editorStore.currentTools === 'pointer'
      },
      onClicked: () => {
        editorStore.currentTools = 'pointer';
      },
    },
  ];
  return tools;
}

function callDocTools(): IDocTool[] {
  const editorStore = useEditorStore();

  const tools: IDocTool[] = [
    {
      id: 'save-menu',
      icon: 'save',
      label: 'Save Menu',
      isActive: () => false,
      onClicked: () => {
        const subTools: IDocTool[] = [
          {
            id: 'save-overwrite',
            icon: 'save',
            label: '上書き保存',
            isActive: () => false,
            onClicked: () => {
              /** TODO: 今後実装 */
            },
          },
          {
            id: 'save-as',
            icon: 'save_as',
            label: '名前を付けて保存',
            isActive: () => false,
            onClicked: () => {
              /** TODO: 今後実装 */
            },
          },
          {
            id: 'auto-save-toggle',
            icon: 'backup',
            label: '自動保存',
            isActive: () => editorStore.autoSaveAnnotations,
            onClicked: () => {
              editorStore.autoSaveAnnotations = !editorStore.autoSaveAnnotations;
            },
          },
        ];
        editorStore.subTools = subTools;
      },
    },
    {
      id: 'print',
      icon: 'print',
      label: 'Print',
      isActive: () => false,
      onClicked: () => {
        // TODO: 暫定実装
        window.print();
      },
    },
    {
      id: 'download',
      icon: 'download',
      label: 'Download',
      isActive: () => false,
      onClicked: () => {
        /** TODO: 今後実装 */
      },
    },
    {
      id: 'toggle-right-drawer',
      icon: 'info',
      label: 'Right Drawer',
      isActive: () => false,
      onClicked: () => {
        editorStore.rightDrawerModel = !editorStore.rightDrawerModel;
      },
    },
  ];
  return tools;
}

export async function callEditorTools(): Promise<IDocTool[]> {
  const pointer = callPointerTools();
  const annotation = await callAnnotationTools();
  const docs = callDocTools();
  return Array.prototype.concat(pointer, annotation, docs);
}

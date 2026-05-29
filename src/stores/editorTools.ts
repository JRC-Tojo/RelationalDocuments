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
      const strStoreStyle = JSON.stringify(editorStore.currentAnnotationStyle);
      const strOriginStyle = JSON.stringify(ann.style);
      return strStoreStyle === strOriginStyle;
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
      label: t('pdfEditor.tools.line'),
      isActive: () => false,
      onClicked: () => registSubTools('line'),
    },
    {
      id: 'annotation-box',
      icon: 'crop_square',
      label: t('pdfEditor.tools.box'),
      isActive: () => false,
      onClicked: () => registSubTools('box'),
    },
    {
      id: 'annotation-circle',
      icon: 'circle',
      label: t('pdfEditor.tools.circle'),
      isActive: () => false,
      onClicked: () => registSubTools('circle'),
    },
    {
      id: 'toggle-annotation-visibility',
      icon: 'visibility',
      label: t('pdfEditor.tools.annotationToggle'),
      isActive: () => editorStore.visibleAnnotations,
      onClicked: () => {
        editorStore.visibleAnnotations = !editorStore.visibleAnnotations;
      },
    },
  ];

  return tools;
}

function callPointerTools(): IDocTool[] {
  const { t } = useI18n();
  const editorStore = useEditorStore();

  const tools: IDocTool[] = [
    {
      id: 'toggle-left-drawer',
      icon: 'menu',
      label: t('pdfEditor.leftDrawer.title'),
      isActive: () => false,
      onClicked: () => {
        editorStore.leftDrawerModel = !editorStore.leftDrawerModel;
      },
    },
    {
      id: 'hand-mode',
      icon: 'pan_tool',
      label: t('pdfEditor.tools.handMode'),
      isActive: () => {
        return editorStore.currentTools === 'hand';
      },
      onClicked: () => {
        editorStore.currentTools = 'hand';
      },
    },
    {
      id: 'select-mode',
      icon: 'touch_app',
      label: t('pdfEditor.tools.selectMode'),
      isActive: () => {
        return editorStore.currentTools === 'pointer';
      },
      onClicked: () => {
        editorStore.currentTools = 'pointer';
      },
    },
  ];
  return tools;
}

function callDocTools(): IDocTool[] {
  const { t } = useI18n();
  const editorStore = useEditorStore();

  const tools: IDocTool[] = [
    {
      id: 'save-menu',
      icon: 'save',
      label: t('pdfEditor.tools.save.title'),
      isActive: () => false,
      onClicked: () => {
        const subTools: IDocTool[] = [
          {
            id: 'save-overwrite',
            icon: 'save',
            label: t('pdfEditor.tools.save.overwrite'),
            isActive: () => false,
            onClicked: () => {
              /** TODO: 今後実装 */
            },
          },
          {
            id: 'save-as',
            icon: 'save_as',
            label: t('pdfEditor.tools.save.saveAs'),
            isActive: () => false,
            onClicked: () => {
              /** TODO: 今後実装 */
            },
          },
          {
            id: 'auto-save-toggle',
            icon: 'backup',
            label: t('pdfEditor.tools.save.auto'),
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
      label: t('pdfEditor.tools.print'),
      isActive: () => false,
      onClicked: () => {
        // TODO: 暫定実装
        window.print();
      },
    },
    {
      id: 'download',
      icon: 'download',
      label: t('pdfEditor.tools.download'),
      isActive: () => false,
      onClicked: () => {
        /** TODO: 今後実装 */
      },
    },
    {
      id: 'tab-tile-menu',
      icon: 'grid_view',
      label: t('pdfEditor.tools.viewStyle.title'),
      isActive: () => false,
      onClicked: () => {
        const subTools: IDocTool[] = [
          {
            id: 'single-tab-mode',
            icon: 'crop_portrait',
            label: t('pdfEditor.tools.viewStyle.noGrid'),
            isActive: () => editorStore.tileMode === 'single',
            onClicked: () => {
              editorStore.tileMode = 'single';
            },
          },
          {
            id: 'dubble-tab-mode',
            icon: 'vertical_split',
            label: t('pdfEditor.tools.viewStyle.split'),
            isActive: () => editorStore.tileMode === 'dubble',
            onClicked: () => {
              editorStore.tileMode = 'dubble';
            },
          },
          {
            id: 'grid-tab-mode',
            icon: 'grid_view',
            label: t('pdfEditor.tools.viewStyle.grid'),
            isActive: () => editorStore.tileMode === 'grid',
            onClicked: () => {
              editorStore.tileMode = 'grid';
            },
          },
        ];
        editorStore.subTools = subTools;
      },
    },
    {
      id: 'toggle-right-drawer',
      icon: 'info',
      label: t('pdfEditor.rightDrawer.title'),
      isActive: () => false,
      onClicked: () => {
        editorStore.rightDrawerModel = !editorStore.rightDrawerModel;
      },
    },
  ];
  return tools;
}

export async function callEditorTools(): Promise<IDocTool[]> {
  const docs = callDocTools();
  const pointer = callPointerTools();
  const annotation = await callAnnotationTools();
  return Array.prototype.concat(pointer, annotation, docs);
}

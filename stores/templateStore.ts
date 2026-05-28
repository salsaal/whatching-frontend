import { MessageTemplate } from "@/api/types/templates.type";
import { create } from "zustand";

interface TemplateState {
  templates: MessageTemplate[];
  setTemplates: (templates: MessageTemplate[]) => void;
  addTemplate: (template: MessageTemplate) => void;
  upsertTemplate: (template: MessageTemplate) => void;
  removeTemplate: (templateId: string) => void;
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) =>
    set((state) => ({
      templates: [
        template,
        ...state.templates.filter(
          (item) => item.templateId !== template.templateId
        )
      ]
    })),
  upsertTemplate: (template) =>
    set((state) => ({
      templates: state.templates.some(
        (item) =>
          item._id === template._id || item.templateId === template.templateId
      )
        ? state.templates.map((item) =>
            item._id === template._id || item.templateId === template.templateId
              ? template
              : item
          )
        : [template, ...state.templates]
    })),
  removeTemplate: (templateId) =>
    set((state) => ({
      templates: state.templates.filter(
        (item) => item.templateId !== templateId && item._id !== templateId
      )
    }))
}));

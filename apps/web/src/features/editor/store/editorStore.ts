import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  redo as redoHistory,
  undo as undoHistory,
  type EditorCommand,
  type EditorHistory,
  type DashboardSnapshot,
} from "@drag-visual/editor-core";
import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorSaveStatus = "idle" | "saving" | "error";

export interface EditorState {
  readonly history: EditorHistory;
  readonly selectedComponentId: string | null;
  readonly dirty: boolean;
  readonly saveStatus: EditorSaveStatus;
  readonly lastSavedRevision: number;
  readonly savedSnapshot: Dashboard;
  readonly savingSnapshot: DashboardSnapshot | null;
  readonly dispatch: (command: EditorCommand) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly select: (componentId: string | null) => void;
  readonly markSaving: () => void;
  readonly markSaveFailed: () => void;
  readonly markSaved: (serverDashboard: unknown) => void;
}

export type EditorStore = StoreApi<EditorState>;

const sameDashboard = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const selectedStillExists = (
  history: EditorHistory,
  selectedComponentId: string | null,
): string | null =>
  selectedComponentId !== null && history.present.components.some(
    (component) => component.id === selectedComponentId,
  )
    ? selectedComponentId
    : null;

export const createEditorStore = (initialDashboard: Dashboard): EditorStore => {
  const initial = DashboardSchema.parse(initialDashboard);
  const initialHistory = createHistory(initial);
  const initialSnapshot = initialHistory.present as Dashboard;
  return createStore<EditorState>((set) => ({
    history: initialHistory,
    selectedComponentId: null,
    dirty: false,
    saveStatus: "idle",
    lastSavedRevision: initial.revision,
    savedSnapshot: initialSnapshot,
    savingSnapshot: null,
    dispatch: (command) => set((state) => {
      const history = execute(state.history, command);
      return {
        history,
        selectedComponentId: selectedStillExists(history, state.selectedComponentId),
        dirty: !sameDashboard(history.present, state.savedSnapshot),
      };
    }),
    undo: () => set((state) => {
      const history = undoHistory(state.history);
      return {
        history,
        selectedComponentId: selectedStillExists(history, state.selectedComponentId),
        dirty: !sameDashboard(history.present, state.savedSnapshot),
      };
    }),
    redo: () => set((state) => {
      const history = redoHistory(state.history);
      return {
        history,
        selectedComponentId: selectedStillExists(history, state.selectedComponentId),
        dirty: !sameDashboard(history.present, state.savedSnapshot),
      };
    }),
    select: (componentId) => set({ selectedComponentId: componentId }),
    markSaving: () => set((state) => ({
      saveStatus: "saving",
      savingSnapshot: state.history.present,
    })),
    markSaveFailed: () => set({ saveStatus: "error", savingSnapshot: null }),
    markSaved: (candidate) => {
      const serverDashboard = DashboardSchema.parse(candidate);
      set((state) => {
        const serverHistory = createHistory(serverDashboard, state.history.limit);
        const serverSnapshot = serverHistory.present as Dashboard;
        const submittedSnapshot = state.savingSnapshot ?? state.history.present;
        const hasLaterLocalEdits = !sameDashboard(
          state.history.present,
          submittedSnapshot,
        );
        const history = hasLaterLocalEdits
          ? createHistory(DashboardSchema.parse({
              ...state.history.present,
              revision: serverDashboard.revision,
              updatedAt: serverDashboard.updatedAt,
            }), state.history.limit)
          : serverHistory;
        return {
          history,
          savedSnapshot: serverSnapshot,
          savingSnapshot: null,
          lastSavedRevision: serverDashboard.revision,
          selectedComponentId: selectedStillExists(history, state.selectedComponentId),
          dirty: hasLaterLocalEdits,
          saveStatus: "idle",
        };
      });
    },
  }));
};

export const editorSelectors = {
  dashboard: (state: EditorState) => state.history.present,
  canUndo: (state: EditorState) => canUndo(state.history),
  canRedo: (state: EditorState) => canRedo(state.history),
  selectedComponent: (state: EditorState) => state.history.present.components.find(
    (component) => component.id === state.selectedComponentId,
  ) ?? null,
};

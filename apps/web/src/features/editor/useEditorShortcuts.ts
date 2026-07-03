import { useEffect } from "react";

import type { EditorStore } from "./store/editorStore.js";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select") ||
    target.closest("[contenteditable]:not([contenteditable='false'])") !== null ||
    target.isContentEditable ||
    (typeof target.contentEditable === "string" && target.contentEditable !== "inherit" && target.contentEditable !== "false");
};

export const useEditorShortcuts = (store: EditorStore, onSave?: () => void): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.getState().redo();
        else store.getState().undo();
        return;
      }
      if (modifier && key === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedComponentId = store.getState().selectedComponentId;
        if (selectedComponentId !== null) {
          event.preventDefault();
          store.getState().dispatch({ type: "component.remove", componentId: selectedComponentId });
          store.getState().select(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, store]);
};

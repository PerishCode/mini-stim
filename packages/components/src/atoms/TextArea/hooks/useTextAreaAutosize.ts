import { useEffect, useLayoutEffect, useRef } from "react";

export type TextAreaAutosize =
  | boolean
  | {
      max: number;
      min: number;
    };

export function useTextAreaAutosize(input: {
  autosize: TextAreaAutosize;
  rows: number;
  value: string | number | readonly string[] | undefined;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const motionTimeoutRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const overflowActiveRef = useRef(false);
  const autosizeConfig = resolveAutosize(input.autosize);
  const resolvedRows = autosizeConfig?.min ?? input.rows;

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (motionTimeoutRef.current !== null) {
        window.clearTimeout(motionTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    const frameElement = frameElementRef.current;
    if (!element || !frameElement || !autosizeConfig) {
      return;
    }

    const computed = window.getComputedStyle(element);
    const borderBox = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
    const paddingBox = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const lineHeight = parseFloat(computed.lineHeight);

    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      return;
    }

    const minHeight = lineHeight * autosizeConfig.min + paddingBox + borderBox;
    const maxHeight = lineHeight * autosizeConfig.max + paddingBox + borderBox;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    if (motionTimeoutRef.current !== null) {
      window.clearTimeout(motionTimeoutRef.current);
      motionTimeoutRef.current = null;
    }

    const previousHeight = frameElement.getBoundingClientRect().height;
    const selectionAtEnd =
      element.selectionStart === element.selectionEnd &&
      element.selectionEnd === element.value.length;
    const pinnedToBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

    element.style.height = "auto";
    const overflowEnabled = element.scrollHeight > maxHeight;
    const overflowJustEnabled = overflowEnabled && !overflowActiveRef.current;
    element.style.overflowY = overflowEnabled ? "auto" : "hidden";

    const targetHeight = Math.min(Math.max(element.scrollHeight + borderBox, minHeight), maxHeight);

    element.style.height = `${targetHeight}px`;
    syncScrollAnchor(element, overflowEnabled, selectionAtEnd || pinnedToBottom);
    overflowActiveRef.current = overflowEnabled;

    if (!initializedRef.current) {
      frameElement.dataset.motion = "idle";
      frameElement.style.height = `${targetHeight}px`;
      initializedRef.current = true;
      return;
    }

    if (Math.abs(previousHeight - targetHeight) < 0.5) {
      frameElement.dataset.motion = "idle";
      frameElement.style.height = `${targetHeight}px`;
      return;
    }

    if (targetHeight < previousHeight) {
      frameElement.dataset.motion = "idle";
      frameElement.style.height = `${targetHeight}px`;
      return;
    }

    frameElement.dataset.motion = "expand";
    frameElement.style.height = `${previousHeight}px`;
    void frameElement.offsetHeight;
    frameRef.current = window.requestAnimationFrame(() => {
      frameElement.style.height = `${targetHeight}px`;
      syncScrollAnchor(element, overflowEnabled, selectionAtEnd || pinnedToBottom);
      if (overflowJustEnabled && (selectionAtEnd || pinnedToBottom)) {
        scrollFrameRef.current = window.requestAnimationFrame(() => {
          syncScrollAnchor(element, true, true);
          scrollFrameRef.current = null;
        });
      }
      motionTimeoutRef.current = window.setTimeout(() => {
        if (frameElementRef.current === frameElement) {
          frameElement.dataset.motion = "idle";
        }
        motionTimeoutRef.current = null;
      }, 180);
      frameRef.current = null;
    });
  });

  return {
    autosizeConfig,
    frameElementRef,
    resolvedRows,
    textareaRef,
  };
}

function resolveAutosize(input: TextAreaAutosize) {
  if (!input) {
    return null;
  }

  if (input === true) {
    return { min: 1, max: 6 };
  }

  const min = Number.isFinite(input.min) ? Math.max(1, Math.floor(input.min)) : 1;
  const max = Number.isFinite(input.max) ? Math.max(min, Math.floor(input.max)) : Math.max(min, 6);

  return { min, max };
}

function syncScrollAnchor(
  element: HTMLTextAreaElement,
  overflowEnabled: boolean,
  anchorToBottom: boolean,
) {
  if (!overflowEnabled) {
    element.scrollTop = 0;
    return;
  }

  if (anchorToBottom) {
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  }
}

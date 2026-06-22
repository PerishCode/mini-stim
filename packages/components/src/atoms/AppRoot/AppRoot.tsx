import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./AppRoot.scss";

export const INTERNAL_APP_NAMESPACE = "mini-stim/internal";

export type AppComponentKind = "panel" | "section" | "message" | "tool" | "control";

export type AppComponentRegistration = {
  copyText?: string;
  domain?: string;
  id: string;
  kind?: AppComponentKind;
  label: string;
  metadata?: Record<string, AppComponentMetadataValue>;
  namespace?: string;
  projection?: string;
  role?: string;
  surface?: string;
  variant?: string;
};

export type AppComponentMetadataValue = boolean | number | string | null | undefined;

export type AppInspectionConfig = {
  namespace?: string;
  options?: {
    labels?: boolean;
  };
};

type RegisteredAppComponent = Required<Pick<AppComponentRegistration, "namespace">> &
  Omit<AppComponentRegistration, "namespace"> & {
    element: HTMLElement;
  };

type AppComponentRegistryContextValue = {
  register: (registration: AppComponentRegistration, element: HTMLElement | null) => void;
};

const AppComponentRegistryContext = createContext<AppComponentRegistryContextValue | null>(null);

export function AppRoot(props: { children: ReactNode; inspection?: AppInspectionConfig | false }) {
  const [registryVersion, setRegistryVersion] = useState(0);
  const registryRef = useRef(new Map<string, RegisteredAppComponent>());
  const shadowHostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const inspectionRef = useRef(props.inspection);

  inspectionRef.current = props.inspection;

  const register = useCallback(
    (registration: AppComponentRegistration, element: HTMLElement | null) => {
      const namespace = registration.namespace ?? INTERNAL_APP_NAMESPACE;
      const key = `${namespace}:${registration.id}`;
      if (!element) {
        registryRef.current.delete(key);
        setRegistryVersion((version) => version + 1);
        return;
      }
      registryRef.current.set(key, {
        ...registration,
        namespace,
        element,
      });
      setRegistryVersion((version) => version + 1);
    },
    [],
  );

  const contextValue = useMemo(() => ({ register }), [register]);

  useEffect(() => {
    const host = document.createElement("div");
    host.className = "msAppRootInspectionHost";
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, inspectionHostStyle);
    document.body.appendChild(host);
    shadowHostRef.current = host;
    shadowRootRef.current = host.attachShadow({ mode: "open" });
    shadowRootRef.current.innerHTML = `<style>${inspectionShadowCss}</style><div class="labels"></div><div class="toasts"></div>`;
    return () => {
      host.remove();
      shadowHostRef.current = null;
      shadowRootRef.current = null;
    };
  }, []);

  useEffect(() => {
    void registryVersion;
    let animationFrame = 0;
    const render = () => {
      animationFrame = 0;
      renderInspectionLabels(
        shadowRootRef.current,
        Array.from(registryRef.current.values()),
        inspectionRef.current,
      );
    };
    const schedule = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    const observer = new ResizeObserver(schedule);
    for (const entry of registryRef.current.values()) {
      observer.observe(entry.element);
    }
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [registryVersion]);

  return (
    <AppComponentRegistryContext.Provider value={contextValue}>
      <div className="msAppRoot">{props.children}</div>
    </AppComponentRegistryContext.Provider>
  );
}

export function useAppComponentRef(registration: AppComponentRegistration) {
  const registry = useContext(AppComponentRegistryContext);
  const lastElementRef = useRef<HTMLElement | null>(null);
  const registrationRef = useRef(registration);

  registrationRef.current = registration;

  return useCallback(
    (element: HTMLElement | null) => {
      if (!registry) {
        return;
      }
      if (lastElementRef.current && lastElementRef.current !== element) {
        registry.register(registrationRef.current, null);
      }
      lastElementRef.current = element;
      registry.register(registrationRef.current, element);
    },
    [registry],
  );
}

function renderInspectionLabels(
  shadowRoot: ShadowRoot | null,
  registrations: RegisteredAppComponent[],
  inspection: AppInspectionConfig | false | undefined,
) {
  if (!shadowRoot) {
    return;
  }
  const container = shadowRoot.querySelector(".labels");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.replaceChildren();
  if (inspection === false || inspection === undefined) {
    return;
  }
  if (!inspection.options?.labels) {
    return;
  }
  const namespace = inspection.namespace ?? INTERNAL_APP_NAMESPACE;
  const placedLabels: InspectionLabelBox[] = [];
  for (const registration of registrations) {
    if (registration.namespace !== namespace || !registration.element.isConnected) {
      continue;
    }
    const rect = registration.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = registration.label;
    label.title = `Copy component context for "${registration.label}"`;
    label.style.left = "0px";
    label.style.top = "0px";
    label.style.visibility = "hidden";
    label.addEventListener("click", () => {
      const payload = formatInspectionMetadata(registration);
      void copyInspectionMetadata(payload)
        .then(() => {
          showInspectionToast(label.getRootNode(), "Copied component context");
        })
        .catch(() => {
          showInspectionToast(label.getRootNode(), "Copy failed");
        });
    });
    container.appendChild(label);
    const labelWidth = label.offsetWidth;
    const labelHeight = label.offsetHeight;
    const labelBox = placeInspectionLabel(
      {
        left: Math.round(rect.right - 4 - labelWidth),
        top: Math.round(rect.top + 3),
      },
      {
        height: labelHeight,
        width: labelWidth,
      },
      placedLabels,
    );
    placedLabels.push(labelBox);
    label.style.left = `${labelBox.left}px`;
    label.style.top = `${labelBox.top}px`;
    label.style.visibility = "";
  }
}

type InspectionLabelBox = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

function placeInspectionLabel(
  origin: { left: number; top: number },
  size: { height: number; width: number },
  placedLabels: InspectionLabelBox[],
) {
  const viewportMargin = 4;
  const maxLeft = Math.max(viewportMargin, window.innerWidth - size.width - viewportMargin);
  const maxTop = Math.max(viewportMargin, window.innerHeight - size.height - viewportMargin);
  const left = clampNumber(origin.left, viewportMargin, maxLeft);
  let top = clampNumber(origin.top, viewportMargin, maxTop);
  let labelBox = makeInspectionLabelBox(left, top, size);
  let attempts = 0;

  while (
    placedLabels.some((placed) => inspectionLabelsOverlap(labelBox, placed)) &&
    attempts < 16
  ) {
    top = clampNumber(top + size.height + 2, viewportMargin, maxTop);
    labelBox = makeInspectionLabelBox(left, top, size);
    attempts += 1;
  }

  return labelBox;
}

function makeInspectionLabelBox(
  left: number,
  top: number,
  size: { height: number; width: number },
): InspectionLabelBox {
  return {
    bottom: top + size.height,
    left,
    right: left + size.width,
    top,
  };
}

function inspectionLabelsOverlap(a: InspectionLabelBox, b: InspectionLabelBox) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatInspectionMetadata(registration: RegisteredAppComponent) {
  if (registration.copyText?.trim()) {
    return registration.copyText.trim();
  }

  return [
    registration.label,
    formatContextPath(registration),
    formatKindRole(registration),
    `id: ${registration.id}`,
    formatMetadataRefs(registration.metadata),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatContextPath(registration: RegisteredAppComponent) {
  return [registration.surface, registration.domain, registration.projection, registration.variant]
    .filter(Boolean)
    .join(" / ");
}

function formatKindRole(registration: RegisteredAppComponent) {
  return [registration.kind, registration.role].filter(Boolean).join(" · ");
}

function formatMetadataRefs(metadata: AppComponentRegistration["metadata"]) {
  const refs = Object.entries(metadata ?? {})
    .map(([key, value]) => [compactMetadataKey(key), formatMetadataValue(value)] as const)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join(" · ");

  return refs ? `refs: ${refs}` : "";
}

function compactMetadataKey(key: string) {
  switch (key) {
    case "message_id":
      return "message";
    case "session_id":
      return "session";
    case "tool_call_id":
      return "call";
    case "tool_result_id":
      return "result";
    case "turn_id":
      return "turn";
    default:
      return key.replaceAll(/_id$/g, "").replaceAll("_", "-");
  }
}

function formatMetadataValue(value: AppComponentMetadataValue) {
  switch (typeof value) {
    case "boolean":
    case "number":
      return String(value);
    case "string":
      return value.trim();
    case "undefined":
      return "";
    default:
      return value === null ? "" : String(value);
  }
}

async function copyInspectionMetadata(payload: string) {
  const context = {
    hasClipboardApi: Boolean(navigator.clipboard?.writeText),
    isSecureContext: window.isSecureContext,
    visibilityState: document.visibilityState,
  };
  if (!navigator.clipboard?.writeText) {
    console.warn("[mini-stim inspection] clipboard API unavailable", context);
    throw new Error("Clipboard API is unavailable");
  }
  await navigator.clipboard.writeText(payload);
  console.info("[mini-stim inspection] copied component context", {
    ...context,
    payload,
  });
}

function showInspectionToast(root: Node, message: string) {
  if (!(root instanceof ShadowRoot)) {
    return;
  }
  const container = root.querySelector(".toasts");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.replaceChildren(toast);
  window.setTimeout(() => {
    if (toast.isConnected) {
      toast.remove();
    }
  }, 1600);
}

const inspectionHostStyle: CSSProperties = {
  inset: "0",
  pointerEvents: "none",
  position: "fixed",
  zIndex: 2147483647,
};

const inspectionShadowCss = `
:host {
  all: initial;
}
.labels {
  inset: 0;
  pointer-events: none;
  position: fixed;
}
.toasts {
  display: grid;
  inset: auto 0 1rem 0;
  justify-items: center;
  pointer-events: none;
  position: fixed;
}
.label {
  border: 1px solid rgba(57, 83, 104, 0.18);
  border-radius: 999px;
  background: rgba(255, 252, 242, 0.64);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.24),
    0 5px 14px -15px rgba(25, 42, 59, 0.28);
  color: rgba(31, 82, 120, 0.72);
  cursor: pointer;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 10px;
  font-weight: 620;
  line-height: 1.25;
  max-width: 18rem;
  overflow: hidden;
  padding: 1px 6px;
  pointer-events: auto;
  position: fixed;
  text-overflow: ellipsis;
  text-transform: uppercase;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease,
    transform 120ms ease;
  user-select: none;
  white-space: nowrap;
}
.label:hover {
  border-color: rgba(35, 79, 113, 0.42);
  background: rgba(255, 252, 242, 0.96);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.38),
    0 8px 18px -14px rgba(25, 42, 59, 0.42);
  color: rgba(21, 65, 98, 0.98);
  transform: translateY(-1px);
}
.toast {
  border: 1px solid rgba(57, 83, 104, 0.22);
  border-radius: 999px;
  background: rgba(255, 252, 242, 0.9);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.28),
    0 10px 28px -18px rgba(25, 42, 59, 0.38);
  color: rgba(31, 82, 120, 0.92);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 640;
  line-height: 1.25;
  max-width: min(22rem, calc(100vw - 2rem));
  overflow: hidden;
  padding: 5px 10px;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;
}
`;

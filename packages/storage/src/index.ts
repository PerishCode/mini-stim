export interface InspectPanePreference {
  open: boolean;
}

export interface NavigationPanePreference {
  mode: "sessions" | "souls";
  open: boolean;
}

export interface DesktopLayoutPreference {
  railWidthPx: number | null;
  inspectWidthPx: number | null;
}

export interface UiPreferences {
  inspect: InspectPanePreference;
  navigation: NavigationPanePreference;
  desktopLayout: DesktopLayoutPreference;
}

export interface UiStorage {
  readonly key: string;
  read(): UiPreferences;
  write(value: UiPreferences): UiPreferences;
  update(updater: (current: UiPreferences) => UiPreferences): UiPreferences;
  reset(): UiPreferences;
}

export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const UI_STORAGE_KEY = "mini-stim:ui-preferences:v1";

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  inspect: {
    open: false,
  },
  navigation: {
    mode: "sessions",
    open: true,
  },
  desktopLayout: {
    railWidthPx: null,
    inspectWidthPx: null,
  },
};

export const uiStorage = createUiStorage();

export function createUiStorage(driver = browserStorageDriver()): UiStorage {
  return {
    key: UI_STORAGE_KEY,
    read() {
      return readPreferences(driver);
    },
    write(value) {
      const normalized = normalizePreferences(value);
      writePreferences(driver, normalized);
      return normalized;
    },
    update(updater) {
      const next = normalizePreferences(updater(readPreferences(driver)));
      writePreferences(driver, next);
      return next;
    },
    reset() {
      removePreferences(driver);
      return defaultPreferences();
    },
  };
}

export function defaultPreferences(): UiPreferences {
  return {
    inspect: {
      open: DEFAULT_UI_PREFERENCES.inspect.open,
    },
    navigation: {
      mode: DEFAULT_UI_PREFERENCES.navigation.mode,
      open: DEFAULT_UI_PREFERENCES.navigation.open,
    },
    desktopLayout: {
      railWidthPx: DEFAULT_UI_PREFERENCES.desktopLayout.railWidthPx,
      inspectWidthPx: DEFAULT_UI_PREFERENCES.desktopLayout.inspectWidthPx,
    },
  };
}

function readPreferences(driver: StorageDriver | null): UiPreferences {
  if (!driver) {
    return defaultPreferences();
  }
  try {
    const raw = driver.getItem(UI_STORAGE_KEY);
    if (!raw) {
      return defaultPreferences();
    }
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return defaultPreferences();
  }
}

function writePreferences(driver: StorageDriver | null, value: UiPreferences) {
  if (!driver) {
    return;
  }
  try {
    driver.setItem(UI_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function removePreferences(driver: StorageDriver | null) {
  if (!driver) {
    return;
  }
  try {
    driver.removeItem(UI_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function normalizePreferences(value: unknown): UiPreferences {
  const source = isRecord(value) ? value : {};
  const inspect = isRecord(source.inspect) ? source.inspect : {};
  const navigation = isRecord(source.navigation) ? source.navigation : {};
  const desktopLayout = isRecord(source.desktopLayout) ? source.desktopLayout : {};
  return {
    inspect: {
      open: inspect.open === true,
    },
    navigation: {
      mode:
        navigation.mode === "sessions" || navigation.mode === "souls"
          ? navigation.mode
          : DEFAULT_UI_PREFERENCES.navigation.mode,
      open:
        typeof navigation.open === "boolean"
          ? navigation.open
          : DEFAULT_UI_PREFERENCES.navigation.open,
    },
    desktopLayout: {
      railWidthPx: nullablePositiveNumber(desktopLayout.railWidthPx),
      inspectWidthPx: nullablePositiveNumber(desktopLayout.inspectWidthPx),
    },
  };
}

function nullablePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function browserStorageDriver(): StorageDriver | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

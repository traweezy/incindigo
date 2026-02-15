import { useSyncExternalStore } from "react";

const authSessionStorageKey = "incindigo_auth_session";
let cachedRawSession: string | null = null;
let cachedSession: AuthSession | null = null;

export type AuthSession = {
  authenticatedAt: string;
  email: string;
  sessionToken: string;
};

const listeners = new Set<() => void>();

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const getStorage = (): StorageLike | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage as Partial<StorageLike>;
  if (
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage as StorageLike;
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const parseAuthSession = (rawValue: string | null): AuthSession | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const decoded = JSON.parse(rawValue) as Partial<AuthSession>;
    if (
      typeof decoded.email === "string" &&
      typeof decoded.sessionToken === "string" &&
      typeof decoded.authenticatedAt === "string"
    ) {
      return {
        authenticatedAt: decoded.authenticatedAt,
        email: decoded.email,
        sessionToken: decoded.sessionToken
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const getAuthSession = (): AuthSession | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(authSessionStorageKey);
  if (raw === cachedRawSession) {
    return cachedSession;
  }

  cachedRawSession = raw;
  cachedSession = parseAuthSession(raw);
  return cachedSession;
};

export const isAuthenticated = (): boolean => {
  return getAuthSession() !== null;
};

export const setAuthSession = (session: AuthSession): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const raw = JSON.stringify(session);
  cachedRawSession = raw;
  cachedSession = session;
  storage.setItem(authSessionStorageKey, raw);
  notifyListeners();
};

export const clearAuthSession = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  cachedRawSession = null;
  cachedSession = null;
  storage.removeItem(authSessionStorageKey);
  notifyListeners();
};

export const getAuthSessionToken = (): string | null => {
  return getAuthSession()?.sessionToken ?? null;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === authSessionStorageKey) {
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
};

export const useAuthSession = (): AuthSession | null => {
  return useSyncExternalStore(subscribe, getAuthSession, () => null);
};

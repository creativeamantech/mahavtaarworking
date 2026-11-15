import { useEffect, useState, useCallback } from "react";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

/**
 * Configured Google Workspace OAuth scopes (Drive & Sheets).
 * Keep in sync with OAuth provisioning.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.activity",
  "https://www.googleapis.com/auth/drive.activity.readonly",
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.apps.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.install",
  "https://www.googleapis.com/auth/drive.meet.readonly",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.photos.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.scripts",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
] as const;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let providerInstance: GoogleAuthProvider | null = null;

function ensureFirebaseAuth(): { auth: Auth; provider: GoogleAuthProvider } {
  if (typeof window === "undefined") {
    throw new Error("Google Workspace authentication is only available in the browser.");
  }
  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!authInstance) {
    authInstance = getAuth(appInstance);
  }
  if (!providerInstance) {
    providerInstance = new GoogleAuthProvider();
    for (const scope of SCOPES) {
      providerInstance.addScope(scope);
    }
    providerInstance.setCustomParameters({ prompt: "consent" });
  }
  return { auth: authInstance, provider: providerInstance };
}

// Strict in-memory token cache (never stored in localStorage/sessionStorage).
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

type AuthListener = () => void;
const listeners = new Set<AuthListener>();
let initializedListener = false;

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function initGoogleAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const { auth } = ensureFirebaseAuth();
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      onAuthFailure?.();
    }
    notifyListeners();
  });
}

function ensureGlobalListener() {
  if (initializedListener || typeof window === "undefined") return;
  initializedListener = true;
  initGoogleAuth();
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  const { auth, provider } = ensureFirebaseAuth();
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to obtain Google Workspace access token.");
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function clearGoogleAccessToken(): void {
  cachedAccessToken = null;
  notifyListeners();
}

export function getCurrentGoogleUser(): User | null {
  return cachedGoogleUser;
}

export async function googleSignOut(): Promise<void> {
  if (typeof window === "undefined") return;
  const { auth } = ensureFirebaseAuth();
  cachedAccessToken = null;
  cachedGoogleUser = null;
  await auth.signOut();
  notifyListeners();
}

export function useGoogleWorkspaceAuth() {
  const [googleUser, setGoogleUser] = useState<User | null>(() => cachedGoogleUser);
  const [accessToken, setAccessToken] = useState<string | null>(() => cachedAccessToken);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    ensureGlobalListener();
    const sync = () => {
      setGoogleUser(cachedGoogleUser);
      setAccessToken(cachedAccessToken);
    };
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const signIn = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      return res;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await googleSignOut();
  }, []);

  const needsAuth = !accessToken;

  return {
    googleUser,
    accessToken,
    needsAuth,
    isConnected: Boolean(accessToken),
    isLoggingIn,
    signIn,
    signOut,
  };
}

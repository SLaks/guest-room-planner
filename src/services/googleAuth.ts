import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Explicitly persist the signed-in Firebase user across page reloads
void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Fallback to Firebase's default persistence if browser blocks IndexedDB
});

function buildProvider(loginHintEmail?: string | null): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SHEETS_SCOPES) {
    provider.addScope(scope);
  }
  if (loginHintEmail) {
    provider.setCustomParameters({
      login_hint: loginHintEmail,
    });
  } else {
    provider.setCustomParameters({
      prompt: 'select_account',
    });
  }
  return provider;
}

let isSigningIn = false;
// In-memory access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthNeedsToken?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthNeedsToken?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthNeedsToken?.(null);
    }
  });
};

export const googleSignIn = async (
  loginHintEmail?: string | null
): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const provider = buildProvider(loginHintEmail);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Google sign-in did not return a Sheets access token. Please allow Google Sheets permission and try again.'
      );
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearCachedToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};

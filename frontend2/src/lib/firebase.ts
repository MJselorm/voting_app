import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";

// ── Firebase Configuration ────────────────────────────────────────────────────
// Values are injected from .env at build time via Vite.
// NEVER hardcode these values — use .env.example as a reference.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

function makeUnavailableError(action: string): Error {
  return new Error(
    `Firebase is not configured. Set the VITE_FIREBASE_* variables before calling ${action}.`,
  );
}

// Initialise Firebase exactly once when config is present.
const app: FirebaseApp | null = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth: Auth | null = app ? getAuth(app) : null;

// ── Auth Functions ────────────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 * Firebase creates the account and returns a credential.
 * A verification email is sent automatically after this call.
 */
export async function registerUser(
  email: string,
  password: string
): Promise<UserCredential> {
  if (!auth) throw makeUnavailableError("registerUser");
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in an existing user with email and password.
 * Firebase validates the credentials and returns a credential with an ID token.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<UserCredential> {
  if (!auth) throw makeUnavailableError("loginUser");
  return signInWithEmailAndPassword(auth, email, password);
}

const googleProvider = new GoogleAuthProvider();

/**
 * Sign in or sign up with Google popup.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  if (!auth) throw makeUnavailableError("signInWithGoogle");
  return signInWithPopup(auth, googleProvider);
}

/**
 * Sign out the currently authenticated user.
 * Clears the local auth state — protected routes will redirect to login.
 */
export async function logoutUser(): Promise<void> {
  if (!auth) return;
  return signOut(auth);
}

/**
 * Send an email verification link to the currently signed-in user.
 * Must be called after registration or when resending verification.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  return sendEmailVerification(user);
}

/**
 * Send a password reset email to the given address.
 * Firebase handles token generation — never implement this manually.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw makeUnavailableError("sendPasswordReset");
  return sendPasswordResetEmail(auth, email);
}

/**
 * Get the currently authenticated Firebase user (synchronous snapshot).
 * Returns null if no user is signed in.
 */
export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

/**
 * Get the Firebase ID token for the current user.
 * Pass forceRefresh=true to always get a fresh token (recommended before API calls).
 * The token is sent to FastAPI as: Authorization: Bearer <token>
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/**
 * Subscribe to Firebase auth state changes.
 * Use this in AuthContext to keep the app in sync with Firebase.
 */
export { onAuthStateChanged };
export type { User, UserCredential };

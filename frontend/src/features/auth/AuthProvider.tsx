import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getFirebaseAuth } from "../../lib/firebase";
import { getAuthErrorMessage } from "./lib/authErrors";
import { authQueryKeys } from "./hooks/authQueryKeys";
import {
  deleteCurrentAccount,
  syncCurrentUser,
  updateCurrentProfile,
} from "./services/authApi";
import type { AuthContextValue, UserProfile } from "./types/auth";

interface SyncVariables {
  uid: string;
}

interface ProfileUpdateVariables extends SyncVariables {
  fullName: string;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const syncMutation = useMutation<UserProfile, Error, SyncVariables>({
    mutationFn: () => syncCurrentUser(),
    onSuccess: (profile, variables) => {
      queryClient.setQueryData(authQueryKeys.profile(variables.uid), profile);
      setProfileError(null);
    },
    onError: (error) => setProfileError(getAuthErrorMessage(error)),
  });
  const updateMutation = useMutation<UserProfile, Error, ProfileUpdateVariables>({
    mutationFn: ({ fullName }) => updateCurrentProfile(fullName),
    onSuccess: (profile, variables) => {
      queryClient.setQueryData(authQueryKeys.profile(variables.uid), profile);
    },
  });

  const syncProfile = useCallback(
    async (uid: string) => {
      setProfileError(null);
      await syncMutation.mutateAsync({ uid });
    },
    [syncMutation.mutateAsync],
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!active) return;
      setUser(firebaseUser);
      setEmailVerified(firebaseUser?.emailVerified ?? false);
      setProfileError(null);
      if (!firebaseUser || !firebaseUser.emailVerified) {
        setLoading(false);
        if (!firebaseUser) {
          queryClient.removeQueries({ queryKey: ["auth", "profile"] });
        }
        return;
      }

      setLoading(true);
      try {
        await syncProfile(firebaseUser.uid);
      } catch {
        // The failure is exposed in profileError and can be retried from the profile UI.
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient, syncProfile]);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const auth = getFirebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
      await updateFirebaseProfile(credential.user, { displayName: fullName.trim() });
      await credential.user.getIdToken(true);
      await sendEmailVerification(credential.user);
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    await setPersistence(auth, browserLocalPersistence);
    return (
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
    ).user;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    await setPersistence(auth, browserLocalPersistence);
    return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const resendVerification = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) throw new Error("Sign in before requesting email verification.");
    await sendEmailVerification(currentUser);
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) return false;
    await reload(currentUser);
    await currentUser.getIdToken(true);
    setUser({ ...currentUser });
    setEmailVerified(currentUser.emailVerified);
    if (currentUser.emailVerified) await syncProfile(currentUser.uid);
    return currentUser.emailVerified;
  }, [syncProfile]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase());
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user || !emailVerified) return;
    await syncProfile(user.uid);
  }, [emailVerified, syncProfile, user]);

  const updateProfile = useCallback(
    async (fullName: string) => {
      if (!user) throw new Error("Sign in to update your profile.");
      const profile = await updateMutation.mutateAsync({
        uid: user.uid,
        fullName: fullName.trim(),
      });
      try {
        await updateFirebaseProfile(user, { displayName: profile.full_name });
      } catch (error) {
        throw new Error(
          `Your profile was saved in UniVote, but Firebase could not sync the display name. ${getAuthErrorMessage(error)}`,
        );
      }
      return profile;
    },
    [updateMutation.mutateAsync, user],
  );

  const deleteAccount = useCallback(async (password?: string) => {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in before deleting your account.");

    const hasPasswordProvider = currentUser.providerData.some(
      (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID,
    );
    const hasGoogleProvider = currentUser.providerData.some(
      (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
    );

    if (hasPasswordProvider) {
      if (!password) throw new Error("Enter your password to confirm account deletion.");
      if (!currentUser.email) throw new Error("This account has no email address to reauthenticate.");
      await reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(currentUser.email, password),
      );
    } else if (hasGoogleProvider) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
    } else {
      throw new Error("This sign-in method cannot reauthenticate for account deletion.");
    }

    await currentUser.getIdToken(true);
    await deleteCurrentAccount();
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error(
        `Your account was permanently deleted, but this browser session could not be signed out. Close this tab and reopen the app. ${getAuthErrorMessage(error)}`,
      );
    }
    queryClient.removeQueries({ queryKey: ["auth", "profile"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      emailVerified,
      profileLoading: syncMutation.isPending || updateMutation.isPending,
      profileError,
      register,
      login,
      loginWithGoogle,
      logout,
      resendVerification,
      refreshEmailVerification,
      resetPassword,
      refreshProfile,
      updateProfile,
      deleteAccount,
    }),
    [
      user,
      loading,
      emailVerified,
      syncMutation.isPending,
      updateMutation.isPending,
      profileError,
      register,
      login,
      loginWithGoogle,
      logout,
      resendVerification,
      refreshEmailVerification,
      resetPassword,
      refreshProfile,
      updateProfile,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const authMessages: Record<string, string> = {
  "auth/email-already-in-use": "An account already exists for this email.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before completing.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account was found for this email.",
  "auth/weak-password": "Choose a stronger password with at least 8 characters.",
  "auth/wrong-password": "Email or password is incorrect.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && authMessages[code]) return authMessages[code];
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

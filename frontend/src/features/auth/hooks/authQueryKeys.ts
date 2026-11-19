export const authQueryKeys = {
  profile: (uid: string) => ["auth", "profile", uid] as const,
};

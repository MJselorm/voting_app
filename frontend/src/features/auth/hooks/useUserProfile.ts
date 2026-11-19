import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./useAuth";
import { authQueryKeys } from "./authQueryKeys";
import { getCurrentProfile } from "../services/authApi";

export function useUserProfile() {
  const { user, emailVerified } = useAuth();
  return useQuery({
    queryKey: authQueryKeys.profile(user?.uid ?? "anonymous"),
    queryFn: getCurrentProfile,
    enabled: Boolean(user && emailVerified),
    retry: false,
    staleTime: 30_000,
  });
}

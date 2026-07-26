import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiData } from "@/lib/client-api";

function toKey(key) {
  return Array.isArray(key) ? key : [key];
}

/**
 * Fetches `path` from the /api/v1 endpoints with the stored bearer token.
 * By default, loading and error states are surfaced to the caller; fixture data
 * is never rendered as live data. `fallback` is reserved for explicit demo mode
 * only and is used on non-auth request failure only outside production when
 * NEXT_PUBLIC_COLARIS_DEMO === "true". Auth failures still propagate.
 */
export function useApiQuery(key, path, { fallback, ...options } = {}) {
  const demoFallback =
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_COLARIS_DEMO === "true"
      ? fallback
      : undefined;
  return useQuery({
    queryKey: toKey(key),
    queryFn: async () => {
      try {
        return await apiData(path);
      } catch (error) {
        if (demoFallback !== undefined && error?.status !== 401 && error?.status !== 403) return demoFallback;
        throw error;
      }
    },
    ...options,
  });
}

/**
 * Calls `path` with the given HTTP `method` and invalidates the listed query
 * keys on success so dependent useApiQuery hooks refetch.
 */
export function useApiMutation(path, method = "POST", { invalidate = [] } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiData(path, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    onSuccess: () => {
      for (const key of invalidate) {
        queryClient.invalidateQueries({ queryKey: toKey(key) });
      }
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiData } from "@/lib/client-api";

function toKey(key) {
  return Array.isArray(key) ? key : [key];
}

/**
 * Fetches `path` from the /api/v1 endpoints with the stored bearer token.
 * Renders the provided fixture `fallback` immediately and keeps it whenever the
 * request fails or auth is unavailable, so pages never blank out.
 */
export function useApiQuery(key, path, { fallback, ...options } = {}) {
  return useQuery({
    queryKey: toKey(key),
    queryFn: async () => {
      try {
        return await apiData(path);
      } catch {
        return fallback;
      }
    },
    initialData: fallback,
    // Treat the fixture as stale so a live fetch runs on mount, exactly like the
    // previous "render sample data, then replace with API data" behaviour.
    initialDataUpdatedAt: 0,
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

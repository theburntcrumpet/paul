import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { handleAuthError } from './useAuth'

/** The app's query client, wired so auth failures anywhere send the user back to sign in. */
export function createQueryClient(options: { retry?: number | false } = {}) {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleAuthError(queryClient, error) }),
    mutationCache: new MutationCache({ onError: (error) => handleAuthError(queryClient, error) }),
    defaultOptions: {
      queries: { retry: options.retry ?? 1, refetchOnWindowFocus: true },
    },
  })
  return queryClient
}

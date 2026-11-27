import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, ApiError, type Me } from '../api/client'

export const ME_KEY = ['me'] as const

/** The signed-in user: `undefined` while loading, `null` when signed out. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.auth.me, staleTime: 60_000 })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.auth.login(username, password),
    onSuccess: (me) => queryClient.setQueryData<Me | null>(ME_KEY, me),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData<Me | null>(ME_KEY, null)
    },
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => api.auth.changePassword(currentPassword, newPassword),
    onSuccess: (me) => queryClient.setQueryData<Me | null>(ME_KEY, me),
  })
}

/**
 * Reacts to auth failures from any query or mutation: a 401 means the session is gone, and
 * PASSWORD_CHANGE_REQUIRED means the password was reset elsewhere. Either way, refresh `me`
 * so the route guards redirect.
 */
export function handleAuthError(queryClient: QueryClient, error: unknown) {
  if (!(error instanceof ApiError)) return
  if (error.status === 401) {
    queryClient.setQueryData<Me | null>(ME_KEY, null)
  } else if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
    void queryClient.invalidateQueries({ queryKey: ME_KEY })
  }
}

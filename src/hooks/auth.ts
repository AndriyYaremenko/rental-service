'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { SessionUser } from '@/server/auth/core'

export function useMe() {
  return useQuery<SessionUser>({ queryKey: ['me'], queryFn: () => apiFetch<SessionUser>('/api/auth/me') })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<SessionUser>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (user) => qc.setQueryData(['me'], user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.setQueryData(['me'], null),
  })
}

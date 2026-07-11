'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export function useList<T>(key: string, path: string) {
  return useQuery<T[]>({ queryKey: [key], queryFn: () => apiFetch<T[]>(path) })
}
export function useCreate<B, R>(key: string, path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: B) => apiFetch<R>(path, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
}
export function useUpdate<B, R>(key: string, path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: B }) => apiFetch<R>(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
}
export function useRemove(key: string, path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
}

import { useQuery } from '@tanstack/react-query'

import { getNimroConfigRecord } from '@/nimro'
import { queryClient, writeCache } from '@/lib/query-client'
import type { NimroConfigRecord } from '@/types/nimro'

// One shared cache for the whole profile config record (`GET /api/config`).
// Every settings surface (MCP, model, config) reads and writes through this key
// so a save in one shows in the others, and revisiting a tab paints the cache
// instead of blanking on a fresh fetch.
//
// Distinct from session/hooks/use-nimro-config.ts, which is side-effecting —
// it pushes personality/cwd/voice/… into the session stores for live chat.
export const NIMRO_CONFIG_KEY = ['nimro-config-record'] as const

// staleTime 0 → serve cache instantly, background-revalidate on every mount.
export const useNimroConfigRecord = () =>
  useQuery({ queryKey: NIMRO_CONFIG_KEY, queryFn: getNimroConfigRecord, staleTime: 0 })

export const setNimroConfigCache = writeCache<NimroConfigRecord>(NIMRO_CONFIG_KEY)

export const invalidateNimroConfig = () => queryClient.invalidateQueries({ queryKey: NIMRO_CONFIG_KEY })

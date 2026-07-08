// src/server.ts
import type { RequestHandler } from '@tanstack/react-start/server'
import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server'
import { createServerEntry } from './server-entry' // adapta para o teu entry atual, se existir

// Handler base gerado pelo TanStack Start
const startFetch = createStartHandler({
  createServerEntry,
})(defaultStreamHandler)

// Opcional: ponto para headers globais, observabilidade, etc. [web:65][web:125]
export const fetch: RequestHandler = defineHandlerCallback(async (request) => {
  // Aqui você pode aplicar lógica adicional (logging, headers, etc.)
  return startFetch(request)
})
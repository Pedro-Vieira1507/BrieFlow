import { useCallback, useRef, useState } from "react";

export type EditableData = Record<string, string>;

interface UseInlineEditorOptions {
  sessionId?: string;
  contentType?: string;
  initialData?: EditableData;
  onSync?: (data: EditableData) => void;
}

/**
 * Hook central da edição inline.
 * - Mantém um espelho do conteúdo editável em `data`
 * - Debounce de 800ms antes de sincronizar com o backend
 * - `setField(key, value)` atualiza um campo individualmente
 * - `sync()` força sincronização imediata
 */
export function useInlineEditor({
  sessionId,
  contentType,
  initialData = {},
  onSync,
}: UseInlineEditorOptions = {}) {
  const [data, setData] = useState<EditableData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-initialise when the artifact changes (new AI response)
  const reset = useCallback((newData: EditableData) => {
    setData(newData);
  }, []);

  const syncToServer = useCallback(
    async (payload: EditableData) => {
      if (!sessionId) return;
      setSyncing(true);
      try {
        await fetch("/api/state/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            contentType,
            editedData: payload,
          }),
        });
        onSync?.(payload);
      } catch {
        // Sync failure is non-fatal — user edits are still preserved in React state
      } finally {
        setSyncing(false);
      }
    },
    [sessionId, contentType, onSync]
  );

  const setField = useCallback(
    (key: string, value: string) => {
      setData((prev) => {
        const next = { ...prev, [key]: value };
        // Debounced sync
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => syncToServer(next), 800);
        return next;
      });
    },
    [syncToServer]
  );

  const sync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    syncToServer(data);
  }, [data, syncToServer]);

  return { data, setField, reset, sync, syncing };
}

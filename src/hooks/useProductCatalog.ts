import { useEffect, useState } from "react";
import {
  catalogOwner,
  catalogChangedEvent,
  listProducts,
} from "@/lib/productCatalog";
import type { CatalogProduct } from "@/lib/skuReview";

export function useProductCatalog(userId?: string) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [owner, setOwner] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let closed = false,
      generation = 0;
    let scope: string;
    try {
      scope = catalogOwner(userId);
    } catch {
      setError("O armazenamento local do catálogo está indisponível.");
      return;
    }
    setOwner(scope);
    async function refresh() {
      const version = ++generation;
      try {
        const rows = await listProducts(scope);
        if (!closed && version === generation) {
          setProducts(rows);
          setReady(true);
          setError("");
        }
      } catch {
        if (!closed) setError("O catálogo não pôde ser lido neste navegador.");
      }
    }
    void refresh();
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(catalogChangedEvent)
        : null;
    if (channel)
      channel.onmessage = (e) => {
        if (e.data === scope) void refresh();
      };
    window.addEventListener(catalogChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      closed = true;
      channel?.close();
      window.removeEventListener(catalogChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  return { products, owner, ready, error };
}

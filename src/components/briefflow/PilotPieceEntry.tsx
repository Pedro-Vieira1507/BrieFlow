import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { catalogOwner } from "@/lib/productCatalog";
import {
  getPendingTarget,
  parsePilotFragment,
  pilotFragment,
  targetAsset,
  type PilotAddress,
  type PilotTarget,
} from "@/lib/pilotNavigation";
import { getSavedPilotCampaign, type SavedLibraryAsset } from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";

export function PilotPieceEntry({
  onOpen,
}: {
  onOpen: (target: PilotTarget, saved: SavedLibraryAsset) => void;
}) {
  const userId = useBriefflowStore((s) => s.user?.id);
  const [address, setAddress] = useState<PilotAddress>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    function readLink() {
      setError("");
      setAddress(parsePilotFragment(window.location.hash));
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  function close() {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    setAddress(undefined);
  }
  useEffect(() => {
    if (!address || !userId) return;
    const location = address,
      account = userId,
      owner = catalogOwner(account),
      initial = useBriefflowStore.getState();
    let cancelled = false;
    async function open() {
      const target = await getPendingTarget(owner, location);
      const saved = await getSavedPilotCampaign(
        account,
        target.piece.campaignId,
        target.piece.libraryAssetId,
      );
      // The original tab can finish or supersede this piece while the library is loading.
      const currentTarget = await getPendingTarget(owner, location, target.sku);
      if (
        cancelled ||
        window.location.hash !==
          pilotFragment(location.revision, location.index)
      )
        return;
      const current = useBriefflowStore.getState();
      if (
        current.user?.id !== userId ||
        current.workspaceVersion !== initial.workspaceVersion ||
        current.workspaceDirty ||
        current.builder.type !== "none" ||
        current.loading ||
        current.scraping
      )
        throw new Error(
          "Há trabalho aberto nesta aba. Volte ao painel e abra a pendência em uma nova aba.",
        );
      if (!targetAsset(currentTarget, saved.content, saved.id))
        throw new Error(
          "A peça mudou ou foi removida da campanha. Confira a versão atual na biblioteca.",
        );
      close();
      onOpen(currentTarget, saved);
    }
    setError("");
    void open().catch((e) => {
      if (!cancelled)
        setError(
          e instanceof Error ? e.message : "Não foi possível abrir a peça.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [address, userId, attempt, onOpen]);
  if (!address) return null;
  return (
    <section
      aria-label="Abertura da peça"
      className="rounded-xl border border-border-strong bg-surface-1 p-4"
    >
      <p role={error ? "alert" : "status"} className="text-sm text-fg-primary">
        {!userId
          ? "Entre com a conta que registrou a mudança para abrir a peça."
          : error || "Abrindo a peça na campanha original…"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {!userId && (
          <Button
            size="sm"
            onClick={() => useBriefflowStore.getState().setAuthOpen(true)}
          >
            Entrar para revisar
          </Button>
        )}
        {userId && error && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar novamente
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={close}>
          Voltar ao estúdio
        </Button>
      </div>
    </section>
  );
}

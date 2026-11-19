import { useEffect, useState } from "react";
import { Clock3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/export-utils";
import { CONTENT_FORMATS } from "@/lib/plans";
import {
  listPilotRuns,
  pilotChangedEvent,
  recordPilot,
} from "@/lib/productCatalog";
import {
  pilotCsv,
  pilotDuration,
  pilotFinishedAt,
  pilotScopeLabel,
  pilotStatus,
  type PilotRun,
} from "@/lib/skuPilot";
import { formatPrice } from "@/lib/skuReview";

const timestamp = (value: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
const subtle = "text-xs text-fg-secondary";
const summaryBox = "rounded-xl border border-border-subtle bg-surface-2/50 p-3";
function ManualComparison({ run }: { run: PilotRun }) {
  const [value, setValue] = useState(
    run.manualSeconds == null
      ? ""
      : (run.manualSeconds / 60).toLocaleString("pt-BR", {
          maximumFractionDigits: 3,
        }),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const end = pilotFinishedAt(run);
  const delta =
    end == null || run.manualSeconds == null
      ? undefined
      : run.manualSeconds - Math.round((end - run.startedAt) / 1000);
  async function save() {
    const raw = value.trim();
    const seconds = raw
      ? Math.round(Number(raw.replace(",", ".")) * 60)
      : undefined;
    if (
      raw &&
      (!/^\d+(?:[.,]\d+)?$/.test(raw) ||
        !seconds ||
        seconds < 1 ||
        !Number.isSafeInteger(seconds))
    ) {
      setMessage(
        "Informe um tempo positivo em minutos, com pelo menos um segundo.",
      );
      return;
    }
    setBusy(true);
    try {
      await recordPilot(run.owner, run.sku, run.revision, {
        type: "manual",
        seconds,
      });
      setMessage(
        seconds == null ? "Referência removida." : "Referência salva.",
      );
    } catch {
      setMessage("Não foi possível salvar o tempo manual.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={summaryBox}>
      <label
        className="text-sm font-medium text-fg-primary"
        htmlFor="sku-pilot-manual"
      >
        Tempo manual das mesmas peças (min)
      </label>
      <p className={subtle}>
        Cronometre a mesma alteração até exportar a última peça pelo processo
        habitual.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          id="sku-pilot-manual"
          inputMode="decimal"
          className="max-w-32"
          placeholder="Ex. 8,5"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage("");
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void save()}
        >
          Salvar tempo manual
        </Button>
      </div>
      {message && (
        <p role="status" className={subtle}>
          {message}
        </p>
      )}
      {delta != null && (
        <p className="mt-2 text-sm font-medium text-fg-primary">
          {delta === 0
            ? "Mesmo tempo nos dois processos."
            : pilotDuration(delta * 1000) +
              (delta > 0
                ? " a menos com o BrieFlow."
                : " a mais com o BrieFlow.")}
        </p>
      )}
    </div>
  );
}
function RunDetails({ run }: { run: PilotRun }) {
  const end = pilotFinishedAt(run);
  const count = run.pieces.filter((p) => p.exportedAt != null).length;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm text-fg-primary">
          <strong>{run.name}</strong> · {run.sku}
        </p>
        <p className="text-sm text-fg-secondary">
          {formatPrice(run.before.priceCents)} · {run.before.unit} →{" "}
          {formatPrice(run.after.priceCents)} · {run.after.unit}
        </p>
        <p className={subtle}>
          {run.demonstration ? "Demonstração" : "Catálogo cadastrado"} ·{" "}
          {pilotScopeLabel(run.scope)} · {run.examined}{" "}
          {run.examined === 1 ? "peça conferida" : "peças conferidas"}
        </p>
      </div>
      <div className={summaryBox}>
        <h4 className="font-semibold text-fg-primary">{pilotStatus(run)}</h4>
        <p className="text-sm text-fg-primary">
          {count} de {run.pieces.length}{" "}
          {run.pieces.length === 1 ? "peça exportada" : "peças exportadas"}
        </p>
        <p className={subtle}>
          Mudança no catálogo · {timestamp(run.startedAt)}
        </p>
        {end != null && (
          <p className="mt-2 text-sm text-fg-primary">
            Até a última exportação ·{" "}
            <strong>{pilotDuration(end - run.startedAt)}</strong>
          </p>
        )}
        {run.scope === "partial" && (
          <p className={subtle}>
            A leitura da biblioteca ficou incompleta. O tempo total está
            indisponível.
          </p>
        )}
        {run.supersededAt != null && (
          <p className={subtle}>
            Uma nova mudança substituiu esta em {timestamp(run.supersededAt)}.
          </p>
        )}
        {run.scope !== "partial" && !run.pieces.length && (
          <p className={subtle}>
            Nenhum arquivo final da amostra precisava mudar.
          </p>
        )}
      </div>
      {run.pieces.length > 0 && (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle px-3">
          {run.pieces.map((p) => (
            <li
              key={JSON.stringify([p.campaignId, p.assetId])}
              className="py-2.5"
            >
              <h5 className="break-words text-sm font-medium text-fg-primary">
                {CONTENT_FORMATS[p.channel].shortLabel} · {p.campaignName}
              </h5>
              {p.reviewedAt != null && (
                <p className={subtle}>
                  Revisão aprovada · {timestamp(p.reviewedAt)}
                </p>
              )}
              <p className={subtle}>
                {p.exportedAt == null
                  ? "Exportação pendente"
                  : "Primeiro arquivo " +
                    p.format +
                    " · " +
                    timestamp(p.exportedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {run.pieces.length > 0 && (
        <ManualComparison
          key={run.revision + String(run.manualSeconds)}
          run={run}
        />
      )}
    </div>
  );
}

export function PilotResults({ owner }: { owner: string }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<PilotRun[]>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let closed = false,
      seq = 0;
    async function refresh() {
      const version = ++seq;
      try {
        const rows = await listPilotRuns(owner);
        if (!closed && seq === version) {
          setRuns(rows);
          setError("");
        }
      } catch {
        if (!closed && seq === version)
          setError("Não foi possível carregar as medições.");
      }
    }
    void refresh();
    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel(pilotChangedEvent);
    if (channel)
      channel.onmessage = (e) => {
        if (e.data === owner) void refresh();
      };
    window.addEventListener(pilotChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      closed = true;
      channel?.close();
      window.removeEventListener(pilotChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [open, owner]);
  const chosen = runs?.find((r) => r.revision === selected) ?? runs?.[0];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSelected("");
          setRuns(undefined);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock3 aria-hidden="true" className="mr-1 size-4" />
          Resultados do piloto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resultados do piloto</DialogTitle>
          <DialogDescription>
            Tempo entre a mudança de preço ou embalagem e o primeiro download do
            arquivo final de cada peça afetada. Histórico desta conta ou sessão
            de visitante neste navegador.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert">{error}</p>
        ) : !runs ? (
          <p role="status">Carregando medições…</p>
        ) : !chosen ? (
          <p className={summaryBox}>
            As medições começam quando você altera o preço ou a embalagem de um
            produto já cadastrado.
          </p>
        ) : (
          <>
            <label className="grid gap-1 text-sm font-medium text-fg-primary">
              Mudança de catálogo
              <select
                className="w-full rounded-md border border-border-strong bg-surface-1 p-2"
                value={chosen.revision}
                onChange={(e) => setSelected(e.target.value)}
              >
                {runs.map((r) => (
                  <option key={r.revision} value={r.revision}>
                    {r.sku} · {timestamp(r.startedAt)} · {pilotStatus(r)}
                  </option>
                ))}
              </select>
            </label>
            <RunDetails run={chosen} />
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([pilotCsv(runs)], {
                    type: "text/csv;charset=utf-8",
                  }),
                  "brieflow-medicoes-piloto.csv",
                )
              }
            >
              <Download aria-hidden="true" className="mr-2 size-4" />
              Baixar medições (CSV)
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

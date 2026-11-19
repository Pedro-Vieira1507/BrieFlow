import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/export-utils";
import { updateCatalog } from "@/lib/skuPilotWorkspace";
import { exampleCsv } from "@/lib/skuDemo";
import {
  getProduct,
  parseCatalogCsv,
  productInput,
  sameProduct,
  type CatalogWrite,
  type ProductForm,
  type ProductInput,
} from "@/lib/productCatalog";
import { formatPrice, type CatalogProduct } from "@/lib/skuReview";
import { toast } from "sonner";

const blank: ProductForm = {
  sku: "",
  name: "",
  price: "",
  unit: "",
  source: "",
  imageUrl: "",
};
function toForm(product?: CatalogProduct): ProductForm {
  return product
    ? {
        sku: product.sku,
        name: product.name,
        price: (product.priceCents / 100).toFixed(2).replace(".", ","),
        unit: product.unit,
        source: product.source,
        imageUrl: product.imageUrl ?? "",
      }
    : blank;
}

export function ProductCatalogDialog({
  owner,
  products,
  initial,
  previousSnapshot,
  canLink,
  onLink,
  onClose,
}: {
  owner: string;
  products: CatalogProduct[];
  initial?: CatalogProduct;
  previousSnapshot?: CatalogProduct;
  canLink: boolean;
  onLink: (product: CatalogProduct) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<CatalogProduct | undefined>(initial);
  const [form, setForm] = useState<ProductForm>(() =>
    toForm(initial ?? previousSnapshot),
  );
  const [pending, setPending] = useState<CatalogWrite[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  function select(product?: CatalogProduct) {
    setSelected(product);
    setForm(toForm(product));
    setError("");
    setPending([]);
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar o catálogo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const input = productInput(form);
    if (!selected || !sameProduct(selected, input))
      await updateCatalog(owner, [
        { input, expected: selected?.revision ?? null },
      ]);
    const current = await getProduct(owner, input.sku);
    if (!current) throw new Error("Reabra o cadastro do produto.");
    select(current);
    toast.success("Cadastro do produto salvo.");
    if (!canLink) onClose();
  }
  async function stageImport(input: File) {
    const rows = parseCatalogCsv(await input.text());
    const writes: CatalogWrite[] = [];
    for (const product of rows) {
      const previous = await getProduct(owner, product.sku);
      if (!previous || !sameProduct(previous, product))
        writes.push({ input: product, expected: previous?.revision ?? null });
    }
    setPending(writes);
    if (!writes.length)
      toast.success("Todos os produtos já estão atualizados.");
  }
  function inputField(
    key: keyof ProductForm,
    label: string,
    props: {
      required?: boolean;
      disabled?: boolean;
      placeholder?: string;
    } = {},
  ) {
    return (
      <label className="grid min-w-0 gap-1 text-sm text-fg-secondary">
        {label}
        <Input
          value={form[key]}
          {...props}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          inputMode={key === "price" ? "decimal" : undefined}
        />
      </label>
    );
  }
  function info(p: ProductInput) {
    return formatPrice(p.priceCents) + " · " + p.unit;
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Catálogo de produtos</DialogTitle>
          <DialogDescription>
            Os cadastros ficam neste navegador. A campanha salva na biblioteca
            leva uma cópia da fonte aprovada.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <label className="grid gap-1 text-sm text-fg-secondary">
            Produto do catálogo
            <select
              className="h-10 w-full rounded-md border border-border-strong bg-surface-2 px-3"
              value={selected?.sku ?? ""}
              onChange={(e) =>
                select(products.find((p) => p.sku === e.target.value))
              }
            >
              <option value="">Cadastrar produto</option>
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act(save);
            }}
            className="grid gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {inputField("sku", "SKU", {
                required: true,
                disabled: !!selected,
              })}
              {inputField("name", "Nome do produto", { required: true })}
              {inputField("price", "Preço em reais", {
                required: true,
                placeholder: "39,90",
              })}
              {inputField("unit", "Unidade ou embalagem", {
                required: true,
                placeholder: "250 g",
              })}
            </div>
            {inputField("source", "Fonte do cadastro", {
              required: true,
              placeholder: "Link do produto ou nome da tabela de preços",
            })}
            {inputField("imageUrl", "URL da foto (opcional)", {
              placeholder: "https://",
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Salvar cadastro</Button>
              {canLink && selected && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!sameForm(form, toForm(selected))}
                  onClick={() =>
                    void act(async () => {
                      const current = await getProduct(owner, selected.sku);
                      if (!current || current.revision !== selected.revision)
                        throw new Error(
                          "O produto mudou. Selecione a versão atual antes de vincular.",
                        );
                      onLink(current);
                    })
                  }
                >
                  Vincular à campanha
                </Button>
              )}
            </div>
          </form>
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Arquivo CSV do catálogo"
              onChange={(event) => {
                const input = event.target.files?.[0];
                event.target.value = "";
                setPending([]);
                if (input) void act(() => stageImport(input));
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => file.current?.click()}
            >
              Importar CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadBlob(
                  new Blob(["\uFEFF", exampleCsv], {
                    type: "text/csv;charset=utf-8",
                  }),
                  "catalogo-de-exemplo.csv",
                )
              }
            >
              Baixar CSV de exemplo
            </Button>
          </div>
          {pending.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border-strong p-3">
              <h3 className="text-sm font-semibold">Conferir importação</h3>
              <ul className="max-h-32 space-y-1 overflow-y-auto break-words text-xs text-fg-secondary">
                {pending.map(({ input, expected }) => {
                  const previous = products.find((p) => p.sku === input.sku);
                  return (
                    <li key={input.sku}>
                      <strong>
                        {input.sku} · {input.name}
                      </strong>{" "}
                      ·{" "}
                      {expected && previous
                        ? info(previous) + " → "
                        : "Novo · "}
                      {info(input)} · {input.source}
                      {input.imageUrl ? " · Com foto" : ""}
                    </li>
                  );
                })}
              </ul>
              <Button
                size="sm"
                onClick={() =>
                  void act(async () => {
                    await updateCatalog(owner, pending);
                    setPending([]);
                    const refreshed =
                      selected && (await getProduct(owner, selected.sku));
                    select(refreshed);
                    toast.success("Importação concluída.");
                  })
                }
              >
                Confirmar importação ({pending.length})
              </Button>
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-amber-300">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function sameForm(a: ProductForm, b: ProductForm) {
  return (Object.keys(a) as (keyof ProductForm)[]).every(
    (key) => a[key] === b[key],
  );
}

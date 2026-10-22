import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteBrandKit,
  getBrandKits,
  saveBrandKit,
  type BrandKit,
  type BrandKitInput,
} from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";

interface Draft extends BrandKitInput {
  keywordsText: string;
  forbiddenTermsText: string;
}

function listToText(values?: string[]): string {
  return (values ?? []).join(", ");
}

function textToList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createDraft(
  brandContext: ReturnType<typeof useBriefflowStore.getState>["brandContext"],
): Draft {
  return {
    name: brandContext.brandName || "Minha marca",
    brandName: brandContext.brandName || "",
    persona: brandContext.persona,
    tone: brandContext.tone,
    framework: brandContext.framework,
    product: brandContext.product || "",
    offer: brandContext.offer || "",
    websiteUrl: brandContext.websiteUrl || brandContext.site?.url || "",
    keywords: brandContext.keywords ?? [],
    forbiddenTerms: brandContext.forbiddenTerms ?? [],
    keywordsText: listToText(brandContext.keywords),
    forbiddenTermsText: listToText(brandContext.forbiddenTerms),
  };
}

function kitToDraft(kit: BrandKit): Draft {
  return {
    name: kit.name,
    brandName: kit.brand_name ?? "",
    persona: kit.persona,
    tone: kit.tone,
    framework: kit.framework,
    product: kit.product ?? "",
    offer: kit.offer ?? "",
    websiteUrl: kit.website_url ?? "",
    keywords: kit.keywords,
    forbiddenTerms: kit.forbidden_terms,
    keywordsText: listToText(kit.keywords),
    forbiddenTermsText: listToText(kit.forbidden_terms),
  };
}

export function BrandKitPanel() {
  const { brandContext, setBrandContext, user } = useBriefflowStore();
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => createDraft(brandContext));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedId) ?? null,
    [kits, selectedId],
  );

  useEffect(() => {
    if (!user) {
      setKits([]);
      setSelectedId(null);
      return;
    }
    let active = true;
    setLoading(true);
    void getBrandKits()
      .then((items) => {
        if (!active) return;
        setKits(items);
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast.error("Não foi possível carregar os Brand Kits", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const selectKit = (id: string) => {
    const kit = kits.find((entry) => entry.id === id);
    if (!kit) return;
    setSelectedId(kit.id);
    setDraft(kitToDraft(kit));
  };

  const newKit = () => {
    setSelectedId(null);
    setDraft(createDraft(brandContext));
  };

  const normalizedDraft = (): BrandKitInput => ({
    name: draft.name,
    brandName: draft.brandName,
    persona: draft.persona,
    tone: draft.tone,
    framework: draft.framework,
    product: draft.product,
    offer: draft.offer,
    websiteUrl: draft.websiteUrl,
    keywords: textToList(draft.keywordsText),
    forbiddenTerms: textToList(draft.forbiddenTermsText),
  });

  const persist = async () => {
    if (!user || saving) return;
    if (!draft.name.trim()) {
      toast.error("Dê um nome ao Brand Kit.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveBrandKit(normalizedDraft(), selectedId);
      setKits((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setSelectedId(saved.id);
      setDraft(kitToDraft(saved));
      toast.success(selectedId ? "Brand Kit atualizado" : "Brand Kit criado");
    } catch (error) {
      toast.error("Não foi possível salvar o Brand Kit", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const apply = () => {
    const value = normalizedDraft();
    setBrandContext((current) => ({
      ...current,
      brandName: value.brandName?.trim() || undefined,
      persona: value.persona.trim() || "Público-alvo",
      tone: value.tone.trim() || "Premium",
      framework: value.framework.trim() || "AIDA",
      product: value.product?.trim() || undefined,
      offer: value.offer?.trim() || undefined,
      websiteUrl: value.websiteUrl?.trim() || undefined,
      keywords: value.keywords ?? [],
      forbiddenTerms: value.forbiddenTerms ?? [],
    }));
    toast.success("Brand Kit aplicado ao briefing", {
      description: "As próximas gerações usarão esta voz e estas restrições.",
    });
  };

  const remove = async () => {
    if (!selectedKit || deleting) return;
    setDeleting(true);
    try {
      await deleteBrandKit(selectedKit.id);
      setKits((current) =>
        current.filter((item) => item.id !== selectedKit.id),
      );
      setSelectedId(null);
      setDraft(createDraft(brandContext));
      toast.success("Brand Kit excluído");
    } catch (error) {
      toast.error("Não foi possível excluir o Brand Kit", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-2/55 p-5 text-sm leading-6 text-fg-tertiary">
        Entre na sua conta para salvar Brand Kits reutilizáveis. As preferências
        atuais continuam funcionando nesta sessão.
      </div>
    );
  }

  return (
    <div className="space-y-5 px-1">
      <div className="rounded-2xl border border-brand/20 bg-brand-muted/40 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Building2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg-primary">
              Identidade reutilizável por marca
            </p>
            <p className="mt-1 text-xs leading-5 text-fg-tertiary">
              Salve público, voz, produto, território verbal e termos proibidos.
              O kit aplicado passa a orientar briefing e geração criativa.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="brand-kit-select">
          Brand Kit salvo
        </label>
        <select
          id="brand-kit-select"
          value={selectedId ?? ""}
          disabled={loading}
          onChange={(event) => {
            if (event.target.value) selectKit(event.target.value);
            else newKit();
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3 text-sm text-fg-primary outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Novo Brand Kit</option>
          {kits.map((kit) => (
            <option key={kit.id} value={kit.id}>
              {kit.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={newKit}
          className="h-11 rounded-xl border-border-strong bg-surface-2"
        >
          <Plus className="mr-2 size-4" /> Novo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Nome do kit", "name", "Ex.: Marca ACME"],
          ["Nome da marca", "brandName", "Ex.: ACME"],
          ["Público principal", "persona", "Ex.: Gestores de operações"],
          ["Tom de voz", "tone", "Ex.: Direto, humano e premium"],
          ["Framework", "framework", "Ex.: AIDA, PAS"],
          ["Produto/serviço", "product", "Ex.: Plataforma de gestão"],
          ["Oferta padrão", "offer", "Somente se for permanente e confirmada"],
          ["Site da marca", "websiteUrl", "https://..."],
        ].map(([label, key, placeholder]) => (
          <div key={key} className="space-y-2">
            <Label
              htmlFor={`brand-kit-${key}`}
              className="text-xs font-semibold text-fg-secondary"
            >
              {label}
            </Label>
            <Input
              id={`brand-kit-${key}`}
              value={String(draft[key as keyof Draft] ?? "")}
              onChange={(event) =>
                update(key as keyof Draft, event.target.value)
              }
              placeholder={placeholder}
              className="h-11 rounded-xl border-border-subtle bg-surface-2 text-fg-primary focus-visible:ring-brand"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="brand-kit-keywords"
            className="text-xs font-semibold text-fg-secondary"
          >
            Palavras e territórios preferidos
          </Label>
          <textarea
            id="brand-kit-keywords"
            value={draft.keywordsText}
            onChange={(event) => update("keywordsText", event.target.value)}
            placeholder="Ex.: clareza, precisão, controle, tranquilidade"
            className="min-h-24 w-full resize-y rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="brand-kit-forbidden"
            className="text-xs font-semibold text-fg-secondary"
          >
            Termos que a IA não deve usar
          </Label>
          <textarea
            id="brand-kit-forbidden"
            value={draft.forbiddenTermsText}
            onChange={(event) =>
              update("forbiddenTermsText", event.target.value)
            }
            placeholder="Ex.: revolucione, exclusivo, imperdível"
            className="min-h-24 w-full resize-y rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-between">
        <div>
          {selectedKit ? (
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => void remove()}
              className="h-11 rounded-xl text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
            >
              {deleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Excluir kit
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={apply}
            className="h-11 rounded-xl border-border-strong bg-surface-2"
          >
            <Check className="mr-2 size-4" /> Aplicar ao briefing
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void persist()}
            className="h-11 rounded-xl bg-brand font-semibold text-brand-fg"
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Salvar Brand Kit
          </Button>
        </div>
      </div>
    </div>
  );
}

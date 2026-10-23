from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, content):
    Path(path).write_text(content)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


replace_once(
    "src/lib/supabase.ts",
    '''  content: BuilderState;
  status: LibraryAssetStatus;
  created_at: string;
''',
    '''  content: BuilderState;
  status: LibraryAssetStatus;
  experiment_group_id?: string | null;
  variant_label?: "A" | "B" | null;
  created_at: string;
''',
)

replace_once(
    "src/lib/supabase.ts",
    '''export interface SavedAssetsPage {
  items: SavedLibraryAsset[];
  nextCursor: SavedAssetsCursor | null;
}

export interface BrandKit {
''',
    '''export interface SavedAssetsPage {
  items: SavedLibraryAsset[];
  nextCursor: SavedAssetsCursor | null;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  user_id: string;
  version_number: number;
  name: string;
  type: string;
  content: BuilderState;
  status: LibraryAssetStatus | null;
  variant_label: "A" | "B" | null;
  created_at: string;
}

export interface SavedAssetVariantResult {
  source: SavedLibraryAsset;
  variant: SavedLibraryAsset;
}

export interface BrandKit {
''',
)

replace_once(
    "src/lib/supabase.ts",
    '''const SAVED_ASSET_COLUMNS =
  "id,user_id,organization_id,name,type,content,status,created_at,updated_at";
''',
    '''const SAVED_ASSET_COLUMNS =
  "id,user_id,organization_id,name,type,content,status,experiment_group_id,variant_label,created_at,updated_at";
''',
)

anchor = '''export async function updateSavedAssetStatus(
  id: string,
  status: LibraryAssetStatus,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (!LIBRARY_ASSET_STATUSES.has(status)) {
    throw new Error("Status de campanha inválido.");
  }
  const user = await requireUser();
  const { data, error } = await supabase
    .from("assets")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (error) throw error;
  return data as SavedLibraryAsset;
}

'''
addition = anchor + r'''const ASSET_VERSION_COLUMNS =
  "id,asset_id,user_id,version_number,name,type,content,status,variant_label,created_at";

export async function getAssetVersions(assetId: string): Promise<AssetVersion[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { data, error } = await supabase
    .from("asset_versions")
    .select(ASSET_VERSION_COLUMNS)
    .eq("asset_id", assetId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(30);

  if (error) throw error;
  const versions = (data ?? []) as AssetVersion[];
  if (!versions.length) return versions;

  const refreshed = await refreshPrivateUrls(
    versions.map(
      (version) =>
        ({
          id: version.id,
          user_id: version.user_id,
          name: version.name,
          type: version.type,
          content: version.content,
          status: version.status ?? "draft",
          created_at: version.created_at,
        }) satisfies SavedLibraryAsset,
    ),
  );

  return versions.map((version, index) => ({
    ...version,
    content: refreshed[index]?.content ?? version.content,
  }));
}

export async function restoreAssetVersion(
  assetId: string,
  versionId: string,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { data: version, error: versionError } = await supabase
    .from("asset_versions")
    .select(ASSET_VERSION_COLUMNS)
    .eq("id", versionId)
    .eq("asset_id", assetId)
    .eq("user_id", user.id)
    .single();

  if (versionError) throw versionError;
  const snapshot = version as AssetVersion;

  const { data, error } = await supabase
    .from("assets")
    .update({ content: snapshot.content })
    .eq("id", assetId)
    .eq("user_id", user.id)
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (error) throw error;
  const [restored] = await refreshPrivateUrls([data as SavedLibraryAsset]);
  return restored ?? (data as SavedLibraryAsset);
}

export async function createSavedAssetVariant(
  assetId: string,
): Promise<SavedAssetVariantResult> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();

  const { data: sourceData, error: sourceError } = await supabase
    .from("assets")
    .select(SAVED_ASSET_COLUMNS)
    .eq("id", assetId)
    .eq("user_id", user.id)
    .single();
  if (sourceError) throw sourceError;

  let source = sourceData as SavedLibraryAsset;
  if (source.variant_label === "B") {
    throw new Error("Esta campanha já é a variação B.");
  }

  const experimentGroupId = source.experiment_group_id ?? source.id;
  const { data: existingVariant, error: existingError } = await supabase
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .eq("experiment_group_id", experimentGroupId)
    .eq("variant_label", "B")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingVariant) {
    throw new Error("Já existe uma variação B para esta campanha.");
  }

  if (
    source.experiment_group_id !== experimentGroupId ||
    source.variant_label !== "A"
  ) {
    const { data: updatedSource, error: updateError } = await supabase
      .from("assets")
      .update({
        experiment_group_id: experimentGroupId,
        variant_label: "A",
      })
      .eq("id", source.id)
      .eq("user_id", user.id)
      .select(SAVED_ASSET_COLUMNS)
      .single();
    if (updateError) throw updateError;
    source = updatedSource as SavedLibraryAsset;
  }

  const baseName = source.name.replace(
    /\s*[·-]\s*Variação\s+[AB]\s*$/i,
    "",
  );
  const { data: variantData, error: variantError } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: normalizeLibraryLabel(`${baseName} · Variação B`),
      type: source.type,
      content: source.content,
      status: "draft",
      experiment_group_id: experimentGroupId,
      variant_label: "B",
    })
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (variantError) {
    if (variantError.message.includes("asset_limit_reached")) {
      throw new Error(
        "Você atingiu o limite de campanhas salvas do seu plano.",
      );
    }
    throw variantError;
  }

  const refreshed = await refreshPrivateUrls([
    source,
    variantData as SavedLibraryAsset,
  ]);
  return {
    source: refreshed[0] ?? source,
    variant: refreshed[1] ?? (variantData as SavedLibraryAsset),
  };
}

'''
replace_once("src/lib/supabase.ts", anchor, addition)

write(
    "src/lib/creativeQuality.ts",
    r'''import type { EditorialIssue } from "./editorialReview";
import type { BuilderState, CampaignAsset } from "../types/builder";

export interface CreativeQualityScore {
  score: number;
  completeness: number;
  editorial: number;
  channelFit: number;
  label: "Excelente" | "Forte" | "Ajustar" | "Revisar";
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function hasText(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function requiredSignals(asset: CampaignAsset): boolean[] {
  const content: BuilderState = asset.content;
  const document = content.structuredContent;

  if (asset.type === "banner") {
    return [
      hasText(content.title),
      hasText(content.cta),
      hasText(content.imagePrompt) ||
        hasText(content.productImageUrl) ||
        hasText(content.backgroundImageUrl),
    ];
  }

  if (asset.type === "email") {
    return [
      hasText(content.preheader),
      hasText(content.title),
      hasText(content.body),
      hasText(content.cta),
      hasText(content.emailHeroImagePrompt) || hasText(content.productImageUrl),
    ];
  }

  if (asset.type === "social") {
    return [
      hasText(content.caption),
      Boolean(content.hashtags?.some((tag) => tag.trim())),
      hasText(content.imagePrompt) || hasText(content.productImageUrl),
    ];
  }

  return [
    hasText(document?.title),
    Boolean(document?.sections.length),
    Boolean(
      document?.sections.every(
        (section) =>
          hasText(section.body) ||
          Boolean(section.items?.some((item) => item.trim())),
      ),
    ),
  ];
}

function channelFitScore(asset: CampaignAsset): number {
  const content = asset.content;
  if (asset.type === "banner") {
    const titleLength = content.title?.trim().length ?? 0;
    return clamp(
      55 +
        (titleLength > 0 && titleLength <= 70 ? 25 : 0) +
        (hasText(content.cta) ? 20 : 0),
    );
  }
  if (asset.type === "email") {
    const bodyLength = content.body?.trim().length ?? 0;
    return clamp(
      50 +
        (hasText(content.preheader) ? 15 : 0) +
        (bodyLength >= 80 ? 20 : 0) +
        (hasText(content.cta) ? 15 : 0),
    );
  }
  if (asset.type === "social") {
    const captionLength = content.caption?.trim().length ?? 0;
    return clamp(
      50 +
        (captionLength >= 40 && captionLength <= 1200 ? 25 : 0) +
        (Boolean(content.hashtags?.length) ? 10 : 0) +
        (hasText(content.imagePrompt) || hasText(content.productImageUrl)
          ? 15
          : 0),
    );
  }

  const sections = content.structuredContent?.sections ?? [];
  return clamp(
    55 +
      (sections.length >= 2 ? 20 : 0) +
      (sections.every((section) => hasText(section.title)) ? 10 : 0) +
      (hasText(content.structuredContent?.cta) || asset.type === "technical_sheet"
        ? 15
        : 0),
  );
}

export function calculateCreativeQuality(
  asset: CampaignAsset,
  issues: EditorialIssue[],
): CreativeQualityScore {
  const required = requiredSignals(asset);
  const completed = required.filter(Boolean).length;
  const completeness = Math.round(
    required.length ? (completed / required.length) * 100 : 0,
  );

  const blocking = issues.filter((issue) => issue.severity === "blocking").length;
  const attention = issues.length - blocking;
  const editorial = clamp(100 - blocking * 45 - attention * 12);
  const channelFit = channelFitScore(asset);
  const score = Math.round(
    completeness * 0.45 + editorial * 0.4 + channelFit * 0.15,
  );

  const label: CreativeQualityScore["label"] =
    score >= 90
      ? "Excelente"
      : score >= 75
        ? "Forte"
        : score >= 60
          ? "Ajustar"
          : "Revisar";

  return {
    score,
    completeness,
    editorial,
    channelFit,
    label,
  };
}
''',
)

replace_once(
    "src/components/briefflow/builder/EditorialReview.tsx",
    '''import { ClipboardCheck, ArrowUpRight } from "lucide-react";
import { reviewEditorialContent } from "@/lib/editorialReview";
''',
    '''import { ClipboardCheck, ArrowUpRight, Gauge } from "lucide-react";
import { reviewEditorialContent } from "@/lib/editorialReview";
import { calculateCreativeQuality } from "@/lib/creativeQuality";
''',
)

replace_once(
    "src/components/briefflow/builder/EditorialReview.tsx",
    '''  const issues = reviewEditorialContent(
    asset.type,
    asset.content,
    brief,
    builder.campaignAssets,
  );
  return (
''',
    '''  const issues = reviewEditorialContent(
    asset.type,
    asset.content,
    brief,
    builder.campaignAssets,
  );
  const quality = calculateCreativeQuality(asset, issues);

  return (
''',
)

replace_once(
    "src/components/briefflow/builder/EditorialReview.tsx",
    '''        Revisão editorial
        <span className="ml-auto rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-fg-secondary">
          {issues.length
            ? `${issues.length} ${issues.length === 1 ? "ponto para revisar" : "pontos para revisar"}`
            : "Pronta para sua revisão"}
        </span>
''',
    '''        Revisão editorial
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand">
          <Gauge className="size-3.5" aria-hidden />
          Score {quality.score}/100 · {quality.label}
        </span>
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-fg-secondary">
          {issues.length
            ? `${issues.length} ${issues.length === 1 ? "ponto para revisar" : "pontos para revisar"}`
            : "Pronta para sua revisão"}
        </span>
''',
)

replace_once(
    "src/components/briefflow/builder/EditorialReview.tsx",
    '''      <p className="mt-2 text-xs leading-5 text-fg-tertiary">
        Verificação de clareza e consistência com o briefing. Confira fatos,
        direitos de imagem e condições comerciais antes de publicar.
      </p>
''',
    '''      <p className="mt-2 text-xs leading-5 text-fg-tertiary">
        Verificação de clareza e consistência com o briefing. Confira fatos,
        direitos de imagem e condições comerciais antes de publicar. O score é
        um indicador heurístico de completude e revisão; não prevê performance.
      </p>
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''import {
  deleteSavedAsset,
  getSavedAssetsPage,
  renameSavedAsset,
  updateSavedAssetStatus,
  type LibraryAssetStatus,
  type SavedAssetsCursor,
  type SavedLibraryAsset,
} from "@/lib/supabase";
''',
    '''import {
  createSavedAssetVariant,
  deleteSavedAsset,
  getAssetVersions,
  getSavedAssetsPage,
  renameSavedAsset,
  restoreAssetVersion,
  updateSavedAssetStatus,
  type AssetVersion,
  type LibraryAssetStatus,
  type SavedAssetsCursor,
  type SavedLibraryAsset,
} from "@/lib/supabase";
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''  PencilLine,
  Check,
  X,
} from "lucide-react";
''',
    '''  PencilLine,
  Check,
  GitCompareArrows,
  History,
  RotateCcw,
  X,
} from "lucide-react";
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''  const [renaming, setRenaming] = useState(false);
  const loadRequestRef = useRef(0);
''',
    '''  const [renaming, setRenaming] = useState(false);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
    null,
  );
  const [creatingVariant, setCreatingVariant] = useState(false);
  const loadRequestRef = useRef(0);
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''  const selectedItem = items[selectedIndex];
  const selectedState: BuilderState | undefined = selectedItem?.content;
  const campaignAssets =
    selectedState?.type === "campaign"
      ? selectedState.campaignAssets
      : undefined;

  const beginRename = () => {
''',
    '''  const selectedItem = items[selectedIndex];
  const selectedState: BuilderState | undefined = selectedItem?.content;
  const campaignAssets =
    selectedState?.type === "campaign"
      ? selectedState.campaignAssets
      : undefined;
  const selectedGroupId =
    selectedItem?.experiment_group_id ?? selectedItem?.id ?? null;
  const hasVariantB = selectedGroupId
    ? items.some(
        (item) =>
          item.experiment_group_id === selectedGroupId &&
          item.variant_label === "B",
      )
    : false;

  useEffect(() => {
    setHistoryOpen(false);
    setVersions([]);
  }, [selectedItem?.id]);

  const beginRename = () => {
''',
)

status_anchor = '''  const handleStatusChange = async (status: LibraryAssetStatus) => {
    if (!selectedItem || updatingStatus || selectedItem.status === status)
      return;
    setUpdatingStatus(true);
    try {
      const updated = await updateSavedAssetStatus(selectedItem.id, status);
      setItems((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      toast.success(`Status alterado para ${libraryStatusLabel(status)}`);
    } catch (error) {
      toast.error("Não foi possível alterar o status", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

'''
status_add = status_anchor + '''  const handleCreateVariant = async () => {
    if (!selectedItem || creatingVariant) return;
    setCreatingVariant(true);
    try {
      const result = await createSavedAssetVariant(selectedItem.id);
      setItems((current) => {
        const updated = current
          .filter((item) => item.id !== result.variant.id)
          .map((item) => (item.id === result.source.id ? result.source : item));
        return [result.variant, ...updated];
      });
      setSelectedIndex(0);
      setHistoryOpen(false);
      setVersions([]);
      toast.success("Variação B criada", {
        description:
          "Ela começa como rascunho e pode seguir uma direção diferente sem alterar a variação A.",
      });
    } catch (error) {
      toast.error("Não foi possível criar a variação B", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreatingVariant(false);
    }
  };

  const handleToggleHistory = async () => {
    if (!selectedItem) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }

    setHistoryOpen(true);
    setLoadingVersions(true);
    try {
      setVersions(await getAssetVersions(selectedItem.id));
    } catch (error) {
      setHistoryOpen(false);
      toast.error("Não foi possível carregar o histórico", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (version: AssetVersion) => {
    if (!selectedItem || restoringVersionId) return;
    setRestoringVersionId(version.id);
    try {
      const restored = await restoreAssetVersion(selectedItem.id, version.id);
      setItems((current) =>
        current.map((item) => (item.id === restored.id ? restored : item)),
      );
      setVersions(await getAssetVersions(selectedItem.id));
      toast.success(`Versão ${version.version_number} restaurada`, {
        description:
          "A restauração foi salva como uma nova versão para manter o histórico completo.",
      });
    } catch (error) {
      toast.error("Não foi possível restaurar esta versão", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRestoringVersionId(null);
    }
  };

'''
replace_once("src/components/briefflow/LibraryModal.tsx", status_anchor, status_add)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''                          <span className="mt-1.5 inline-flex rounded-full border border-border-subtle bg-surface-1 px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                            {libraryStatusLabel(item.status)}
                          </span>
''',
    '''                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="inline-flex rounded-full border border-border-subtle bg-surface-1 px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                              {libraryStatusLabel(item.status)}
                            </span>
                            {item.variant_label ? (
                              <span className="inline-flex rounded-full border border-brand/20 bg-brand-muted px-2 py-0.5 text-[10px] font-semibold text-brand">
                                Variação {item.variant_label}
                              </span>
                            ) : null}
                          </span>
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''                            </h4>
                            <button
                              type="button"
                              onClick={beginRename}
''',
    '''                            </h4>
                            {selectedItem.variant_label ? (
                              <span className="shrink-0 rounded-full border border-brand/20 bg-brand-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                                Variação {selectedItem.variant_label}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={beginRename}
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateToCanvas(selectedItem)}
                          className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                        >
                          <CopyPlus className="mr-1.5 size-4" /> Criar cópia
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApplyToCanvas(selectedItem)}
                          className="w-full rounded-xl bg-brand text-xs font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:w-auto"
                        >
                          Continuar original
                          <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
''',
    '''                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            creatingVariant ||
                            selectedItem.variant_label === "B" ||
                            hasVariantB
                          }
                          onClick={() => void handleCreateVariant()}
                          className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                        >
                          {creatingVariant ? (
                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                          ) : (
                            <GitCompareArrows className="mr-1.5 size-4" />
                          )}
                          {selectedItem.variant_label === "B" || hasVariantB
                            ? "Variação B criada"
                            : "Criar variação B"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={loadingVersions}
                          onClick={() => void handleToggleHistory()}
                          className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                        >
                          {loadingVersions ? (
                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                          ) : (
                            <History className="mr-1.5 size-4" />
                          )}
                          {historyOpen ? "Ocultar histórico" : "Histórico"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateToCanvas(selectedItem)}
                          className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                        >
                          <CopyPlus className="mr-1.5 size-4" /> Criar cópia
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApplyToCanvas(selectedItem)}
                          className="w-full rounded-xl bg-brand text-xs font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:w-auto"
                        >
                          Continuar original
                          <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
''',
)

replace_once(
    "src/components/briefflow/LibraryModal.tsx",
    '''                    <CampaignTabs
                      assets={campaignAssets}
                      onAssetChange={handleAssetPatch}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
''',
    '''                    {historyOpen ? (
                      <section
                        aria-label="Histórico da campanha"
                        className="rounded-2xl border border-border-strong bg-surface-1/80 p-4 shadow-[var(--shadow-soft)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h5 className="text-sm font-semibold text-fg-primary">
                              Histórico de versões
                            </h5>
                            <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                              Cada salvamento de conteúdo cria um snapshot. Restaurar
                              também gera uma nova versão, sem apagar as anteriores.
                            </p>
                          </div>
                          <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-fg-secondary">
                            {versions.length} versões
                          </span>
                        </div>

                        {loadingVersions ? (
                          <div
                            className="mt-4 flex min-h-24 items-center justify-center text-fg-muted"
                            role="status"
                          >
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Carregando histórico...
                          </div>
                        ) : versions.length ? (
                          <div className="mt-4 space-y-2">
                            {versions.map((version, index) => (
                              <div
                                key={version.id}
                                className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-fg-primary">
                                      Versão {version.version_number}
                                    </span>
                                    {index === 0 ? (
                                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                        Atual
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs text-fg-muted">
                                    {new Date(version.created_at).toLocaleString(
                                      "pt-BR",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </p>
                                </div>
                                {index === 0 ? null : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={Boolean(restoringVersionId)}
                                    onClick={() =>
                                      void handleRestoreVersion(version)
                                    }
                                    className="rounded-xl border-border-strong bg-surface-1 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                                  >
                                    {restoringVersionId === version.id ? (
                                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="mr-1.5 size-4" />
                                    )}
                                    Restaurar
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 rounded-xl border border-dashed border-border-strong p-4 text-xs leading-5 text-fg-tertiary">
                            O histórico começará no próximo salvamento desta
                            campanha.
                          </p>
                        )}
                      </section>
                    ) : null}

                    <CampaignTabs
                      assets={campaignAssets}
                      onAssetChange={handleAssetPatch}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
''',
)

write(
    "tests/campaign-history.test.mjs",
    r'''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("campaign history is private and snapshots only content changes", () => {
  const migration = read(
    "supabase/migrations/20261023121500_add_asset_versions_and_ab_variants.sql",
  );
  assert.match(
    migration,
    /alter table public\.asset_versions enable row level security/i,
  );
  assert.match(migration, /asset_versions_select_own/);
  assert.match(
    migration,
    /after insert or update of content on public\.assets/i,
  );
  assert.match(migration, /new\.content is not distinct from old\.content/i);
});

test("saved campaigns expose A/B variants and restorable history", () => {
  const supabase = read("src/lib/supabase.ts");
  const library = read("src/components/briefflow/LibraryModal.tsx");
  assert.match(supabase, /createSavedAssetVariant/);
  assert.match(supabase, /getAssetVersions/);
  assert.match(supabase, /restoreAssetVersion/);
  assert.match(library, /Criar variação B/);
  assert.match(library, /Histórico de versões/);
  assert.match(library, /handleRestoreVersion/);
});

test("creative review exposes a non-predictive quality score", () => {
  const score = read("src/lib/creativeQuality.ts");
  const review = read("src/components/briefflow/builder/EditorialReview.tsx");
  assert.match(score, /calculateCreativeQuality/);
  assert.match(score, /completeness/);
  assert.match(score, /editorial/);
  assert.match(review, /Score \{quality\.score\}\/100/);
  assert.match(review, /não prevê performance/);
});
''',
)

print("phase 3 patch applied")

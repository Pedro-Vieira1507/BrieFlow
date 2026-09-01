// src/store/briefflow.ts
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { ChatMessage } from "@/components/briefflow/chat/types";
import type {
  BrandContext,
  BuilderState,
  CampaignAsset,
  SiteBrandData,
} from "@/types/builder";
import type { MaterialType } from "@/types/brief";

interface Scores {
  persuasion: number;
  clarity: number;
  seo: number;
}

interface BriefflowState {
  messages: ChatMessage[];
  builder: BuilderState;
  brandContext: BrandContext;
  scores?: Scores;
  loading: boolean;
  scraping: boolean;
  generatingLabel?: string;
  user: User | null;
  uploadedImage: string | null;
  authOpen: boolean;
  libraryOpen: boolean;
  // actions
  setMessages: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setBuilder: (
    updater: BuilderState | ((prev: BuilderState) => BuilderState),
  ) => void;
  patchBuilder: (patch: Partial<BuilderState>) => void;
  patchCampaignAssets: (assets: CampaignAsset[]) => void;
  updateCampaignAsset: (
    kind: MaterialType,
    updater: CampaignAsset | ((prev?: CampaignAsset) => CampaignAsset),
  ) => void;
  setBrandContext: (
    updater: BrandContext | ((prev: BrandContext) => BrandContext),
  ) => void;
  mergeSiteIntoContext: (site: SiteBrandData) => void;
  setScores: (scores?: Scores) => void;
  setLoading: (v: boolean) => void;
  setScraping: (v: boolean) => void;
  setGeneratingLabel: (v?: string) => void;
  setUser: (user: User | null) => void;
  setUploadedImage: (img: string | null) => void;
  setAuthOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  reset: () => void;
}

const initialBrand: BrandContext = {
  persona: "Público-alvo",
  tone: "Premium",
  framework: "AIDA",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const useBriefflowStore = create<BriefflowState>((set) => ({
  messages: [],
  builder: { type: "none" },
  brandContext: initialBrand,
  scores: undefined,
  loading: false,
  scraping: false,
  generatingLabel: undefined,
  user: null,
  uploadedImage: null,
  authOpen: false,
  libraryOpen: false,
  setMessages: (updater) =>
    set((s) => ({
      messages: typeof updater === "function" ? updater(s.messages) : updater,
    })),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  setBuilder: (updater) =>
    set((s) => ({
      builder: typeof updater === "function" ? updater(s.builder) : updater,
    })),
  patchBuilder: (patch) =>
    set((s) => ({ builder: { ...s.builder, ...patch } as BuilderState })),
  patchCampaignAssets: (campaignAssets) =>
    set((s) => ({
      builder: {
        ...s.builder,
        type: "campaign",
        campaignAssets,
      } as BuilderState,
    })),
  updateCampaignAsset: (kind, updater) =>
    set((s) => {
      const prevAssets =
        s.builder.type === "campaign" ? (s.builder.campaignAssets ?? []) : [];
      const idx = prevAssets.findIndex((a) => a.type === kind);
      const prevAsset = idx >= 0 ? prevAssets[idx] : undefined;
      const nextAsset =
        typeof updater === "function"
          ? (updater as (p?: CampaignAsset) => CampaignAsset)(prevAsset)
          : updater;
      const nextAssets =
        idx >= 0
          ? prevAssets.map((a, i) => (i === idx ? nextAsset : a))
          : [...prevAssets, nextAsset];
      return {
        builder: {
          ...s.builder,
          type: "campaign",
          campaignAssets: nextAssets,
        } as BuilderState,
      };
    }),
  setBrandContext: (updater) =>
    set((s) => ({
      brandContext:
        typeof updater === "function" ? updater(s.brandContext) : updater,
    })),
  mergeSiteIntoContext: (site) =>
    set((s) => ({
      brandContext: {
        ...s.brandContext,
        brandName: site.brandName || s.brandContext.brandName,
        site,
        persona:
          s.brandContext.persona === "Público-alvo"
            ? `Público da marca ${site.brandName}`
            : s.brandContext.persona,
      },
    })),
  setScores: (scores) => set({ scores }),
  setLoading: (loading) => set({ loading }),
  setScraping: (scraping) => set({ scraping }),
  setGeneratingLabel: (generatingLabel) => set({ generatingLabel }),
  setUser: (user) =>
    set((state) => {
      const previousUserId = state.user?.id;
      const nextUserId = user?.id;
      const mustClearPrivateWorkspace = Boolean(
        previousUserId && previousUserId !== nextUserId,
      );
      if (!mustClearPrivateWorkspace) return { user };

      return {
        user,
        messages: [],
        builder: { type: "none" },
        brandContext: initialBrand,
        scores: undefined,
        loading: false,
        scraping: false,
        generatingLabel: undefined,
        uploadedImage: null,
        authOpen: false,
        libraryOpen: false,
      };
    }),
  setUploadedImage: (img) => set({ uploadedImage: img }),
  setAuthOpen: (authOpen) => set({ authOpen }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  reset: () =>
    set({
      messages: [],
      builder: { type: "none" },
      brandContext: initialBrand,
      scores: undefined,
      loading: false,
      scraping: false,
      generatingLabel: undefined,
      uploadedImage: null,
      authOpen: false,
      libraryOpen: false,
    }),
}));

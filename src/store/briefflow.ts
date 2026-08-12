// src/store/briefflow.ts
import { create } from "zustand";
import type { ChatMessage } from "@/components/briefflow/chat/types";
import type {
  BrandContext,
  BuilderState,
  CampaignAsset,
  SiteBrandData,
} from "@/types/builder";
import { supabase } from "@/lib/supabase";

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
  user: any | null;
  uploadedImage: string | null;
  authOpen: boolean;
  libraryOpen: boolean;
  queueStatus: 'idle' | 'waiting' | 'processing';
  queuePosition: number;
  // actions
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setBuilder: (updater: BuilderState | ((prev: BuilderState) => BuilderState)) => void;
  patchBuilder: (patch: Partial<BuilderState>) => void;
  patchCampaignAssets: (assets: CampaignAsset[]) => void;
  updateCampaignAsset: (
    kind: "banner" | "email" | "social",
    updater: CampaignAsset | ((prev?: CampaignAsset) => CampaignAsset),
  ) => void;
  setBrandContext: (updater: BrandContext | ((prev: BrandContext) => BrandContext)) => void;
  mergeSiteIntoContext: (site: SiteBrandData) => void;
  setScores: (scores?: Scores) => void;
  setLoading: (v: boolean) => void;
  setScraping: (v: boolean) => void;
  setGeneratingLabel: (v?: string) => void;
  setUser: (user: any | null) => void;
  setUploadedImage: (img: string | null) => void;
  setAuthOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  // Ações da Fila
  enqueueOllama: (ticketId: string) => Promise<void>;
  dequeueOllama: (ticketId: string) => Promise<void>;
  reset: () => void;
}

const initialBrand: BrandContext = {
  persona: "Público-alvo",
  tone: "Premium",
  framework: "AIDA",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

const queueChannels = new Map<string, any>();

export const useBriefflowStore = create<BriefflowState>((set, get) => ({
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
  queueStatus: 'idle',
  queuePosition: 0,
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
      builder: { ...s.builder, type: "campaign", campaignAssets } as BuilderState,
    })),
  updateCampaignAsset: (kind, updater) =>
    set((s) => {
      const prevAssets =
        s.builder.type === "campaign" ? s.builder.campaignAssets ?? [] : [];
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
  setUser: (user) => set({ user }),
  setUploadedImage: (img) => set({ uploadedImage: img }),
  setAuthOpen: (authOpen) => set({ authOpen }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  enqueueOllama: (ticketId: string) => {
    return new Promise<void>((resolve) => {
      if (!supabase) {
        set({ queueStatus: 'processing' });
        resolve();
        return;
      }

      const myJoinedAt = Date.now();
      set({ queueStatus: 'waiting', queuePosition: 1 });

      const channel = supabase.channel('ollama_queue_room', {
        config: { presence: { key: ticketId } }
      });

      queueChannels.set(ticketId, channel);

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const allUsers: any[] = [];
          for (const id in state) {
            if (Array.isArray(state[id])) {
              allUsers.push(...state[id]);
            }
          }

          const processingUsers = allUsers.filter((u: any) => u.status === 'processing');
          const waitingUsers = allUsers
            .filter((u: any) => u.status === 'waiting')
            .sort((a: any, b: any) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));

          const myIndex = waitingUsers.findIndex((u: any) => u.id === ticketId);

          if (myIndex !== -1) {
            const pos = processingUsers.length + myIndex + 1;
            set({ queuePosition: pos });

            if (processingUsers.length === 0 && myIndex === 0) {
              set({ queueStatus: 'processing', generatingLabel: undefined });
              channel.track({ id: ticketId, status: 'processing', joinedAt: myJoinedAt });
              resolve();
            } else {
              set({ generatingLabel: `Muitas gerações no momento. Você é o ${pos}º da fila...` });
            }
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ id: ticketId, status: 'waiting', joinedAt: myJoinedAt });
          }
        });
    });
  },
  dequeueOllama: async (ticketId: string) => {
    const channel = queueChannels.get(ticketId);
    if (channel) {
      await channel.untrack();
      await supabase?.removeChannel(channel);
      queueChannels.delete(ticketId);
    }
    if (queueChannels.size === 0) {
      set({ queueStatus: 'idle', queuePosition: 0, generatingLabel: undefined });
    }
  },
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
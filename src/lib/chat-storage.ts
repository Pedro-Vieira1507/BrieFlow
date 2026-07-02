// Local-first persistence for chat threads.
// Schema is stable so a future Neon-backed server function can drop in.

export type Role = "user" | "assistant";

export type Artifact =
  | { kind: "html"; html: string; title?: string; prompt?: string }
  | { kind: "image"; url: string; prompt: string }
  | { kind: "markdown"; markdown: string; title?: string }
  | { kind: "text"; text: string };

export type ContentType = "email" | "banner" | "instagram" | "datasheet" | "image" | "text";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  artifact?: Artifact;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  /** Tipo do último conteúdo gerado — usado para ícone e label na sidebar */
  lastContentType?: ContentType;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const KEY = "marketing-ai:threads:v1";

function safeRead(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(threads: Thread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    // ignore quota
  }
}

export function listThreads(): Thread[] {
  return safeRead().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getThread(id: string): Thread | undefined {
  return safeRead().find((t) => t.id === id);
}

export function createThread(): Thread {
  const now = Date.now();
  const thread: Thread = {
    id: generateId(),
    title: "Nova conversa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const all = safeRead();
  all.push(thread);
  safeWrite(all);
  return thread;
}

export function deleteThread(id: string) {
  safeWrite(safeRead().filter((t) => t.id !== id));
}

export function renameThread(id: string, title: string) {
  const all = safeRead();
  const t = all.find((x) => x.id === id);
  if (!t) return;
  t.title = title.slice(0, 80);
  t.updatedAt = Date.now();
  safeWrite(all);
}

export function appendMessage(threadId: string, message: Message) {
  const all = safeRead();
  const t = all.find((x) => x.id === threadId);
  if (!t) return;
  t.messages.push(message);
  t.updatedAt = Date.now();
  if (t.title === "Nova conversa" && message.role === "user") {
    t.title = message.content.slice(0, 60);
  }
  safeWrite(all);
}

export function updateMessage(threadId: string, messageId: string, patch: Partial<Message>) {
  const all = safeRead();
  const t = all.find((x) => x.id === threadId);
  if (!t) return;
  const m = t.messages.find((x) => x.id === messageId);
  if (!m) return;
  Object.assign(m, patch);
  t.updatedAt = Date.now();
  safeWrite(all);
}

export function setThreadContentType(threadId: string, contentType: ContentType) {
  const all = safeRead();
  const t = all.find((x) => x.id === threadId);
  if (!t) return;
  t.lastContentType = contentType;
  safeWrite(all);
}

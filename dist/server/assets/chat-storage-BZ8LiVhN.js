//#region src/lib/chat-storage.ts
function generateId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.random() * 16 | 0;
		return (c === "x" ? r : r & 3 | 8).toString(16);
	});
}
var KEY = "marketing-ai:threads:v1";
function safeRead() {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function safeWrite(threads) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(KEY, JSON.stringify(threads));
	} catch {}
}
function listThreads() {
	return safeRead().sort((a, b) => b.updatedAt - a.updatedAt);
}
function getThread(id) {
	return safeRead().find((t) => t.id === id);
}
function createThread() {
	const now = Date.now();
	const thread = {
		id: generateId(),
		title: "Nova conversa",
		createdAt: now,
		updatedAt: now,
		messages: []
	};
	const all = safeRead();
	all.push(thread);
	safeWrite(all);
	return thread;
}
function deleteThread(id) {
	safeWrite(safeRead().filter((t) => t.id !== id));
}
function appendMessage(threadId, message) {
	const all = safeRead();
	const t = all.find((x) => x.id === threadId);
	if (!t) return;
	t.messages.push(message);
	t.updatedAt = Date.now();
	if (t.title === "Nova conversa" && message.role === "user") t.title = message.content.slice(0, 60);
	safeWrite(all);
}
function updateMessage(threadId, messageId, patch) {
	const all = safeRead();
	const t = all.find((x) => x.id === threadId);
	if (!t) return;
	const m = t.messages.find((x) => x.id === messageId);
	if (!m) return;
	Object.assign(m, patch);
	t.updatedAt = Date.now();
	safeWrite(all);
}
//#endregion
export { listThreads as a, getThread as i, createThread as n, updateMessage as o, deleteThread as r, appendMessage as t };

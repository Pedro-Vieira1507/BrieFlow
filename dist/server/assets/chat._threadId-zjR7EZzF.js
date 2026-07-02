import { a as listThreads, i as getThread, n as createThread, o as updateMessage, r as deleteThread, t as appendMessage } from "./chat-storage-BZ8LiVhN.js";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ArrowUp, Code2, Copy, Download, FileText, ImageIcon, Mail, MessageSquarePlus, Pencil, Printer, RefreshCw, Sparkles, Square, Trash2, User2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Toaster, toast } from "sonner";
//#region src/lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/ui/button.tsx
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ jsx(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
//#endregion
//#region src/components/ui/textarea.tsx
var Textarea = React.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ jsx("textarea", {
		className: cn("flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Textarea.displayName = "Textarea";
//#endregion
//#region src/components/ChatPanel.tsx
function ChatPanel({ messages, onSend, onStop, isStreaming }) {
	const [input, setInput] = useState("");
	const textareaRef = useRef(null);
	const bottomRef = useRef(null);
	useEffect(() => {
		textareaRef.current?.focus();
	}, [messages.length, isStreaming]);
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length, isStreaming]);
	function submit() {
		const text = input.trim();
		if (!text || isStreaming) return;
		setInput("");
		onSend(text);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-full flex-col",
		children: [/* @__PURE__ */ jsx("div", {
			className: "thin-scroll flex-1 overflow-y-auto px-5 py-6",
			children: messages.length === 0 ? /* @__PURE__ */ jsx(EmptyChat, { onPick: (p) => onSend(p) }) : /* @__PURE__ */ jsxs("div", {
				className: "mx-auto flex max-w-2xl flex-col gap-5",
				children: [
					messages.map((m) => /* @__PURE__ */ jsx(MessageRow, { message: m }, m.id)),
					isStreaming && /* @__PURE__ */ jsx(Typing, {}),
					/* @__PURE__ */ jsx("div", { ref: bottomRef })
				]
			})
		}), /* @__PURE__ */ jsx("div", {
			className: "border-t border-border bg-background/60 px-4 py-4 backdrop-blur",
			children: /* @__PURE__ */ jsxs("div", {
				className: "mx-auto max-w-2xl",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-end gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40",
					children: [/* @__PURE__ */ jsx(Textarea, {
						ref: textareaRef,
						value: input,
						onChange: (e) => setInput(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						},
						placeholder: "Peça um e-mail HTML, uma imagem para Instagram, uma ficha técnica…",
						rows: 1,
						className: "min-h-[44px] resize-none border-0 bg-transparent focus-visible:ring-0"
					}), isStreaming ? /* @__PURE__ */ jsx(Button, {
						size: "icon",
						variant: "secondary",
						onClick: onStop,
						"aria-label": "Parar",
						children: /* @__PURE__ */ jsx(Square, { className: "h-4 w-4" })
					}) : /* @__PURE__ */ jsx(Button, {
						size: "icon",
						onClick: submit,
						disabled: !input.trim(),
						"aria-label": "Enviar",
						children: /* @__PURE__ */ jsx(ArrowUp, { className: "h-4 w-4" })
					})]
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-center text-xs text-muted-foreground",
					children: "Enter para enviar · Shift+Enter para nova linha · Conectado ao Ollama local"
				})]
			})
		})]
	});
}
function MessageRow({ message }) {
	const isUser = message.role === "user";
	return /* @__PURE__ */ jsxs("div", {
		className: `flex gap-3 ${isUser ? "flex-row-reverse" : ""}`,
		children: [/* @__PURE__ */ jsx("div", {
			className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`,
			children: isUser ? /* @__PURE__ */ jsx(User2, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" })
		}), /* @__PURE__ */ jsx("div", {
			className: isUser ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground" : "max-w-[85%] text-sm text-foreground",
			children: isUser ? /* @__PURE__ */ jsx("p", {
				className: "whitespace-pre-wrap leading-relaxed",
				children: message.content
			}) : /* @__PURE__ */ jsx("div", {
				className: "prose-chat",
				children: /* @__PURE__ */ jsx(ReactMarkdown, { children: message.content || "…" })
			})
		})]
	});
}
function Typing() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ jsx("div", {
			className: "flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground",
			children: /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" })
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5",
			children: [
				/* @__PURE__ */ jsx(Dot, { delay: "0ms" }),
				/* @__PURE__ */ jsx(Dot, { delay: "150ms" }),
				/* @__PURE__ */ jsx(Dot, { delay: "300ms" })
			]
		})]
	});
}
function Dot({ delay }) {
	return /* @__PURE__ */ jsx("span", {
		className: "h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground",
		style: { animationDelay: delay }
	});
}
function EmptyChat({ onPick }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex max-w-xl flex-col items-center gap-6 pt-16 text-center",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary",
				children: /* @__PURE__ */ jsx(Sparkles, { className: "h-7 w-7" })
			}),
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
				className: "text-2xl font-semibold tracking-tight",
				children: "Agente de Marketing"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "Diga o que você precisa — texto, e-mail HTML, ficha técnica ou imagem — e veja o artefato renderizado ao lado."
			})] }),
			/* @__PURE__ */ jsx("div", {
				className: "grid w-full gap-2 sm:grid-cols-2",
				children: [
					"Crie um e-mail HTML de Black Friday para um e-commerce de tênis",
					"Gere uma imagem de marketing para um café especial, estilo minimalista",
					"Monte uma ficha técnica de um fone bluetooth premium",
					"Escreva 3 legendas de Instagram para lançamento de SaaS"
				].map((s) => /* @__PURE__ */ jsx("button", {
					onClick: () => onPick(s),
					className: "rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm transition hover:border-primary/60 hover:bg-card",
					children: s
				}, s))
			})
		]
	});
}
//#endregion
//#region src/components/EditableField.tsx
/**
* EditableField — a single editable piece of content.
*
* Renders as the `as` element with contentEditable enabled.
* A dashed outline appears on hover, a solid ring on focus.
* Pressing Enter (without Shift) in single-line mode blurs the element.
*/
function EditableField({ value, onChange, as: Tag = "div", className, placeholder = "Clique para editar…", multiline = false, plainText = true }) {
	const ref = useRef(null);
	useEffect(() => {
		if (ref.current && ref.current.innerText !== value) ref.current.innerText = value;
	}, [value]);
	function handleInput() {
		if (ref.current) onChange(ref.current.innerText);
	}
	function handleKeyDown(e) {
		if (e.key === "Enter" && !multiline) {
			e.preventDefault();
			ref.current?.blur();
		}
		if (e.key === "Enter" && multiline && !e.shiftKey) {
			e.preventDefault();
			ref.current?.blur();
		}
	}
	return /* @__PURE__ */ jsx(Tag, {
		ref,
		contentEditable: true,
		suppressContentEditableWarning: true,
		spellCheck: true,
		onInput: handleInput,
		onKeyDown: handleKeyDown,
		"data-placeholder": placeholder,
		className: cn("editable-field outline-none transition-all duration-150", "hover:ring-1 hover:ring-dashed hover:ring-primary/40 hover:rounded-sm", "focus:ring-2 focus:ring-primary focus:rounded-sm focus:bg-primary/5", "cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none", className)
	});
}
//#endregion
//#region src/hooks/useInlineEditor.ts
/**
* Hook central da edição inline.
* - Mantém um espelho do conteúdo editável em `data`
* - Debounce de 800ms antes de sincronizar com o backend
* - `setField(key, value)` atualiza um campo individualmente
* - `sync()` força sincronização imediata
*/
function useInlineEditor({ sessionId, contentType, initialData = {}, onSync } = {}) {
	const [data, setData] = useState(initialData);
	const [syncing, setSyncing] = useState(false);
	const debounceRef = useRef(null);
	const reset = useCallback((newData) => {
		setData(newData);
	}, []);
	const syncToServer = useCallback(async (payload) => {
		if (!sessionId) return;
		setSyncing(true);
		try {
			await fetch("/api/state/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					contentType,
					editedData: payload
				})
			});
			onSync?.(payload);
		} catch {} finally {
			setSyncing(false);
		}
	}, [
		sessionId,
		contentType,
		onSync
	]);
	return {
		data,
		setField: useCallback((key, value) => {
			setData((prev) => {
				const next = {
					...prev,
					[key]: value
				};
				if (debounceRef.current) clearTimeout(debounceRef.current);
				debounceRef.current = setTimeout(() => syncToServer(next), 800);
				return next;
			});
		}, [syncToServer]),
		reset,
		sync: useCallback(() => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			syncToServer(data);
		}, [data, syncToServer]),
		syncing
	};
}
//#endregion
//#region src/components/previews/EmailPreview.tsx
/**
* EmailPreview — renders a realistic email template with fully inline-editable fields.
* Every text node can be clicked and edited directly. Changes are debounce-synced
* with the backend session via useInlineEditor.
*/
function EmailPreview({ data, sessionId, onDataChange }) {
	const { data: editable, setField, reset } = useInlineEditor({
		sessionId,
		contentType: "email",
		initialData: data,
		onSync: (d) => onDataChange?.(d)
	});
	useEffect(() => {
		reset(data);
	}, [JSON.stringify(data)]);
	const accent = editable.brand_color || "#01696f";
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto max-w-[600px] rounded-xl border border-border bg-white shadow-lg overflow-hidden text-[#1a1a1a] font-sans",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "border-b border-border/60 bg-muted/40 px-5 py-3 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-baseline gap-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "font-semibold text-foreground",
						children: "Assunto:"
					}), /* @__PURE__ */ jsx(EditableField, {
						as: "span",
						value: editable.subject ?? "",
						onChange: (v) => setField("subject", v),
						placeholder: "Linha de assunto…",
						className: "flex-1 text-foreground font-medium"
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex items-baseline gap-2 mt-0.5",
					children: [/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: "Preheader:"
					}), /* @__PURE__ */ jsx(EditableField, {
						as: "span",
						value: editable.preheader ?? "",
						onChange: (v) => setField("preheader", v),
						placeholder: "Texto de previsualização…",
						className: "flex-1"
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col items-center justify-center px-8 py-12 text-center",
				style: { backgroundColor: accent },
				children: [
					editable.logo_url && /* @__PURE__ */ jsx("img", {
						src: editable.logo_url,
						alt: "Logo",
						className: "mb-6 h-10 w-auto object-contain"
					}),
					/* @__PURE__ */ jsx(EditableField, {
						as: "h1",
						value: editable.headline ?? "",
						onChange: (v) => setField("headline", v),
						placeholder: "Headline principal…",
						className: "text-2xl font-bold leading-tight text-white"
					}),
					(editable.subheadline ?? "").length > 0 && /* @__PURE__ */ jsx(EditableField, {
						as: "p",
						value: editable.subheadline ?? "",
						onChange: (v) => setField("subheadline", v),
						placeholder: "Subtítulo…",
						className: "mt-3 text-base text-white/85 max-w-md"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "px-8 py-8",
				children: [/* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.body ?? "",
					onChange: (v) => setField("body", v),
					placeholder: "Corpo do e-mail…",
					multiline: true,
					className: "text-sm leading-relaxed text-[#444]"
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-8 flex justify-center",
					children: /* @__PURE__ */ jsx(EditableField, {
						as: "span",
						value: editable.cta_text ?? "",
						onChange: (v) => setField("cta_text", v),
						placeholder: "Texto do botão",
						className: cn("inline-block rounded-lg px-8 py-3 text-sm font-bold text-white cursor-text"),
						style: { backgroundColor: accent }
					})
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "border-t border-border/40 bg-muted/30 px-8 py-5 text-center",
				children: /* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.footer ?? "",
					onChange: (v) => setField("footer", v),
					placeholder: "Rodapé do e-mail…",
					multiline: true,
					className: "text-xs text-muted-foreground leading-relaxed"
				})
			})
		]
	});
}
//#endregion
//#region src/components/previews/BannerPreview.tsx
var FORMAT_DIMS = {
	square: {
		width: 500,
		height: 500,
		label: "1080×1080 (Feed)"
	},
	landscape: {
		width: 500,
		height: 281,
		label: "1920×1080 (Landscape)"
	},
	story: {
		width: 281,
		height: 500,
		label: "1080×1920 (Stories)"
	},
	banner: {
		width: 600,
		height: 160,
		label: "1200×314 (Banner)"
	}
};
/**
* BannerPreview — renders a social/banner canvas with editable overlay text.
* The background image can be replaced by clicking the image area.
* All copy elements are inline-editable.
*/
function BannerPreview({ data, sessionId, onDataChange }) {
	const fileRef = useRef(null);
	const { data: editable, setField, reset } = useInlineEditor({
		sessionId,
		contentType: "banner",
		initialData: data,
		onSync: (d) => onDataChange?.(d)
	});
	useEffect(() => {
		reset(data);
	}, [JSON.stringify(data)]);
	const fmt = FORMAT_DIMS[editable.format ?? "square"];
	const accent = editable.brand_color || "#01696f";
	const hasBg = Boolean(editable.background_url);
	function handleBgClick() {
		fileRef.current?.click();
	}
	function handleBgChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			if (ev.target?.result) setField("background_url", ev.target.result);
		};
		reader.readAsDataURL(file);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex flex-col items-center gap-3",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-xs text-muted-foreground",
			children: fmt.label
		}), /* @__PURE__ */ jsxs("div", {
			className: "relative overflow-hidden rounded-xl border border-border shadow-lg",
			style: {
				width: fmt.width,
				height: fmt.height,
				backgroundColor: accent,
				backgroundImage: hasBg ? `url(${editable.background_url})` : void 0,
				backgroundSize: "cover",
				backgroundPosition: "center"
			},
			children: [
				hasBg && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/45" }),
				/* @__PURE__ */ jsxs("div", {
					className: "absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-10",
					children: [
						/* @__PURE__ */ jsx(EditableField, {
							as: "h2",
							value: editable.headline ?? "",
							onChange: (v) => setField("headline", v),
							placeholder: "Headline…",
							className: "text-2xl font-extrabold leading-tight text-white drop-shadow-md"
						}),
						(editable.subheadline ?? "").length > 0 && /* @__PURE__ */ jsx(EditableField, {
							as: "p",
							value: editable.subheadline ?? "",
							onChange: (v) => setField("subheadline", v),
							placeholder: "Subtítulo…",
							className: "text-sm text-white/85 max-w-xs drop-shadow"
						}),
						(editable.cta_text ?? "").length > 0 && /* @__PURE__ */ jsx(EditableField, {
							as: "span",
							value: editable.cta_text ?? "",
							onChange: (v) => setField("cta_text", v),
							placeholder: "CTA",
							className: "mt-2 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold drop-shadow",
							style: { color: accent }
						})
					]
				}),
				/* @__PURE__ */ jsxs("button", {
					onClick: handleBgClick,
					className: "absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/70 transition-colors",
					title: "Trocar imagem de fundo",
					children: [/* @__PURE__ */ jsx(ImageIcon, { className: "h-3.5 w-3.5" }), "Trocar fundo"]
				}),
				/* @__PURE__ */ jsx("input", {
					ref: fileRef,
					type: "file",
					accept: "image/*",
					className: "hidden",
					onChange: handleBgChange
				})
			]
		})]
	});
}
//#endregion
//#region src/components/ui/badge.tsx
var badgeVariants = cva("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
	variants: { variant: {
		default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
		secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
		destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
		outline: "text-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
//#region src/components/previews/CopyPreview.tsx
var PLATFORM_COLORS = {
	instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
	linkedin: "bg-blue-700",
	twitter: "bg-sky-500",
	facebook: "bg-blue-600",
	tiktok: "bg-black"
};
/**
* CopyPreview — renders a social media post preview.
* Every text section (hook, body, CTA, hashtags) is inline-editable.
* Shows a character counter that updates as the user types.
*/
function CopyPreview({ data, sessionId, onDataChange }) {
	const { data: editable, setField, reset } = useInlineEditor({
		sessionId,
		contentType: "copy",
		initialData: data,
		onSync: (d) => onDataChange?.(d)
	});
	useEffect(() => {
		reset(data);
	}, [JSON.stringify(data)]);
	const platform = (editable.platform ?? "instagram").toLowerCase();
	const gradient = PLATFORM_COLORS[platform] ?? "bg-primary";
	const totalChars = (editable.hook?.length ?? 0) + (editable.body?.length ?? 0) + (editable.cta?.length ?? 0) + (editable.hashtags?.length ?? 0);
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto max-w-[520px] rounded-2xl border border-border bg-card shadow-lg overflow-hidden",
		children: [/* @__PURE__ */ jsxs("div", {
			className: `${gradient} px-5 py-3 flex items-center justify-between`,
			children: [/* @__PURE__ */ jsx("span", {
				className: "text-sm font-semibold text-white capitalize",
				children: platform
			}), /* @__PURE__ */ jsxs(Badge, {
				variant: "secondary",
				className: "text-xs",
				children: [totalChars, " caracteres"]
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "p-6 space-y-4",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ jsx("div", { className: "h-9 w-9 rounded-full bg-muted" }), /* @__PURE__ */ jsxs("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ jsx("div", { className: "h-2.5 w-24 rounded bg-muted" }), /* @__PURE__ */ jsx("div", { className: "h-2 w-16 rounded bg-muted/70" })]
					})]
				}),
				/* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.hook ?? "",
					onChange: (v) => setField("hook", v),
					placeholder: "Hook — primeira linha que prende a atenção…",
					className: "text-sm font-semibold leading-snug text-foreground"
				}),
				/* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.body ?? "",
					onChange: (v) => setField("body", v),
					placeholder: "Corpo do post…",
					multiline: true,
					className: "text-sm leading-relaxed text-foreground/90"
				}),
				(editable.cta ?? "").length > 0 && /* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.cta ?? "",
					onChange: (v) => setField("cta", v),
					placeholder: "CTA…",
					className: "text-sm font-medium text-primary"
				}),
				/* @__PURE__ */ jsx(EditableField, {
					as: "p",
					value: editable.hashtags ?? "",
					onChange: (v) => setField("hashtags", v),
					placeholder: "#hashtags",
					className: "text-xs text-blue-500/80 leading-relaxed"
				})
			]
		})]
	});
}
//#endregion
//#region src/components/ArtifactPanel.tsx
function ArtifactPanel({ artifact, loading, loadingIntent, sessionId, onRefineRequest }) {
	const [view, setView] = useState("preview");
	const [editedData, setEditedData] = useState(null);
	const handleDataChange = useCallback((d) => {
		setEditedData(d);
	}, []);
	if (loading) return /* @__PURE__ */ jsx(LoadingState, { intent: loadingIntent ?? "text" });
	if (!artifact) return /* @__PURE__ */ jsx(EmptyState, {});
	const previewType = detectPreviewType(artifact);
	const artifactData = artifact.data ?? parseHTMLtoData(artifact.html ?? "", previewType);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-full flex-col",
		children: [/* @__PURE__ */ jsxs("header", {
			className: "flex items-center justify-between border-b border-border bg-card/40 px-5 py-3 backdrop-blur",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2 text-sm font-medium",
				children: [
					/* @__PURE__ */ jsx(ArtifactIcon, {
						kind: artifact.kind,
						previewType
					}),
					/* @__PURE__ */ jsx("span", {
						className: "capitalize",
						children: labelFor(artifact, previewType)
					}),
					previewType !== "raw" && /* @__PURE__ */ jsxs("span", {
						className: "ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary",
						children: [/* @__PURE__ */ jsx(Pencil, { className: "h-3 w-3" }), " Clique para editar"]
					})
				]
			}), /* @__PURE__ */ jsx(Toolbar, {
				artifact,
				view,
				onViewChange: setView,
				previewType,
				editedData,
				onRefineRequest
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "thin-scroll flex-1 overflow-auto p-4",
			children: [
				previewType === "email" && view === "preview" && /* @__PURE__ */ jsx(EmailPreview, {
					data: artifactData,
					sessionId,
					onDataChange: handleDataChange
				}),
				previewType === "banner" && view === "preview" && /* @__PURE__ */ jsx(BannerPreview, {
					data: artifactData,
					sessionId,
					onDataChange: handleDataChange
				}),
				previewType === "copy" && view === "preview" && /* @__PURE__ */ jsx(CopyPreview, {
					data: artifactData,
					sessionId,
					onDataChange: handleDataChange
				}),
				previewType === "raw" && artifact.kind === "html" && view === "preview" && /* @__PURE__ */ jsx("iframe", {
					title: "Pré-visualização",
					sandbox: "allow-same-origin",
					className: "h-full min-h-[600px] w-full rounded-lg bg-white",
					srcDoc: artifact.html
				}),
				artifact.kind === "html" && view === "code" && /* @__PURE__ */ jsx("pre", {
					className: "thin-scroll m-0 h-full overflow-auto rounded-lg bg-[oklch(0.14_0.01_270)] p-5 text-xs leading-relaxed text-foreground",
					children: /* @__PURE__ */ jsx("code", { children: artifact.html })
				}),
				artifact.kind === "image" && /* @__PURE__ */ jsx("div", {
					className: "flex h-full items-center justify-center p-6",
					children: /* @__PURE__ */ jsx("img", {
						src: artifact.url,
						alt: artifact.prompt,
						className: "max-h-full max-w-full rounded-xl shadow-2xl ring-1 ring-border"
					})
				}),
				artifact.kind === "markdown" && /* @__PURE__ */ jsx("div", {
					id: "print-area",
					className: "prose-artifact mx-auto max-w-3xl px-8 py-10",
					children: /* @__PURE__ */ jsx(ReactMarkdown, { children: artifact.markdown })
				}),
				artifact.kind === "text" && /* @__PURE__ */ jsx("div", {
					className: "prose-artifact mx-auto max-w-3xl px-8 py-10 whitespace-pre-wrap",
					children: artifact.text
				})
			]
		})]
	});
}
function Toolbar({ artifact, view, onViewChange, previewType, editedData, onRefineRequest }) {
	function handleRefine() {
		const prompt = window.prompt("O que deseja ajustar neste conteúdo?", "Reescreva o headline com mais urgência");
		if (prompt) onRefineRequest?.(prompt);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-2",
		children: [
			onRefineRequest && previewType !== "raw" && /* @__PURE__ */ jsxs(Button, {
				size: "sm",
				variant: "outline",
				onClick: handleRefine,
				children: [/* @__PURE__ */ jsx(RefreshCw, { className: "mr-1 h-3.5 w-3.5" }), " Refinar com IA"]
			}),
			artifact.kind === "html" && /* @__PURE__ */ jsxs(Fragment, { children: [
				previewType !== "raw" && /* @__PURE__ */ jsxs("div", {
					className: "inline-flex overflow-hidden rounded-md border border-border",
					children: [/* @__PURE__ */ jsx(Button, {
						size: "sm",
						variant: view === "preview" ? "default" : "ghost",
						className: "rounded-none",
						onClick: () => onViewChange("preview"),
						children: "Preview"
					}), /* @__PURE__ */ jsxs(Button, {
						size: "sm",
						variant: view === "code" ? "default" : "ghost",
						className: "rounded-none",
						onClick: () => onViewChange("code"),
						children: [/* @__PURE__ */ jsx(Code2, { className: "mr-1 h-4 w-4" }), " HTML"]
					})]
				}),
				/* @__PURE__ */ jsxs(Button, {
					size: "sm",
					variant: "secondary",
					onClick: () => copy(buildExportHTML(artifact, editedData), "HTML copiado"),
					children: [/* @__PURE__ */ jsx(Copy, { className: "mr-1 h-4 w-4" }), " Copiar"]
				}),
				/* @__PURE__ */ jsxs(Button, {
					size: "sm",
					onClick: () => download(buildExportHTML(artifact, editedData), "email.html", "text/html"),
					children: [/* @__PURE__ */ jsx(Download, { className: "mr-1 h-4 w-4" }), " Baixar"]
				})
			] }),
			artifact.kind === "image" && /* @__PURE__ */ jsxs(Button, {
				size: "sm",
				onClick: () => downloadImage(artifact.url),
				children: [/* @__PURE__ */ jsx(Download, { className: "mr-1 h-4 w-4" }), " Baixar imagem"]
			}),
			artifact.kind === "markdown" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
				size: "sm",
				variant: "secondary",
				onClick: () => copy(artifact.markdown, "Markdown copiado"),
				children: [/* @__PURE__ */ jsx(Copy, { className: "mr-1 h-4 w-4" }), " Copiar"]
			}), /* @__PURE__ */ jsxs(Button, {
				size: "sm",
				onClick: exportPdf,
				children: [/* @__PURE__ */ jsx(Printer, { className: "mr-1 h-4 w-4" }), " PDF"]
			})] }),
			artifact.kind === "text" && /* @__PURE__ */ jsxs(Button, {
				size: "sm",
				variant: "secondary",
				onClick: () => copy(artifact.text, "Texto copiado"),
				children: [/* @__PURE__ */ jsx(Copy, { className: "mr-1 h-4 w-4" }), " Copiar"]
			})
		]
	});
}
function detectPreviewType(artifact) {
	if (artifact.data) {
		const t = artifact.data.content_type ?? artifact.data.type;
		if (t === "email" || t === "email_marketing") return "email";
		if (t === "banner" || t === "instagram" || t === "social_image") return "banner";
		if (t === "copy" || t === "social_copy" || t === "post") return "copy";
	}
	const html = artifact.html ?? "";
	if (html.includes("data-preview-type=\"email\"")) return "email";
	if (html.includes("data-preview-type=\"banner\"")) return "banner";
	if (html.includes("data-preview-type=\"copy\"")) return "copy";
	return "raw";
}
function parseHTMLtoData(html, _type) {
	const get = (attr) => {
		const m = html.match(new RegExp(`data-field="${attr}"[^>]*>([^<]*)`, "i"));
		return m ? m[1].trim() : "";
	};
	return {
		headline: get("headline"),
		subheadline: get("subheadline"),
		body: get("body"),
		cta_text: get("cta_text"),
		footer: get("footer"),
		subject: get("subject"),
		preheader: get("preheader"),
		hook: get("hook"),
		hashtags: get("hashtags")
	};
}
/** Merges in-place edits back into the original HTML for export */
function buildExportHTML(artifact, edits) {
	if (!edits || !artifact.html) return artifact.html ?? "";
	let html = artifact.html;
	for (const [key, value] of Object.entries(edits)) html = html.replace(new RegExp(`(data-field="${key}"[^>]*>)[^<]*`, "gi"), `$1${value}`);
	return html;
}
function ArtifactIcon({ kind, previewType }) {
	if (previewType === "email" || kind === "html") return /* @__PURE__ */ jsx(Mail, { className: "h-4 w-4 text-primary" });
	if (kind === "image") return /* @__PURE__ */ jsx(ImageIcon, { className: "h-4 w-4 text-accent" });
	if (kind === "markdown") return /* @__PURE__ */ jsx(FileText, { className: "h-4 w-4 text-primary" });
	return /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4 text-primary" });
}
function labelFor(a, previewType) {
	if (previewType === "email") return "E-mail Marketing";
	if (previewType === "banner") return "Banner / Social";
	if (previewType === "copy") return "Copy / Post";
	if (a.kind === "html") return "HTML";
	if (a.kind === "image") return "Imagem";
	if (a.kind === "markdown") return a.title ?? "Ficha técnica";
	return "Texto gerado";
}
function copy(text, msg) {
	navigator.clipboard.writeText(text).then(() => toast.success(msg));
}
function download(content, filename, mime) {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
async function downloadImage(url) {
	try {
		const blob = await (await fetch(url)).blob();
		const objectUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = objectUrl;
		a.download = `marketing-${Date.now()}.png`;
		a.click();
		URL.revokeObjectURL(objectUrl);
	} catch {
		window.open(url, "_blank");
	}
}
async function exportPdf() {
	const el = document.getElementById("print-area");
	if (!el) return;
	try {
		const mod = (await import("html2pdf.js")).default;
		await mod(el).set({
			margin: 12,
			filename: `ficha-tecnica-${Date.now()}.pdf`,
			image: {
				type: "jpeg",
				quality: .98
			},
			html2canvas: {
				scale: 2,
				backgroundColor: "#ffffff"
			},
			jsPDF: {
				unit: "mm",
				format: "a4",
				orientation: "portrait"
			}
		}).save();
	} catch {
		window.print();
	}
}
function EmptyState() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-full flex-col items-center justify-center px-8 text-center text-muted-foreground",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-5 grid grid-cols-2 gap-3 opacity-80",
				children: [
					/* @__PURE__ */ jsx(Tile, {
						icon: /* @__PURE__ */ jsx(Mail, { className: "h-5 w-5" }),
						label: "E-mails"
					}),
					/* @__PURE__ */ jsx(Tile, {
						icon: /* @__PURE__ */ jsx(ImageIcon, { className: "h-5 w-5" }),
						label: "Banners"
					}),
					/* @__PURE__ */ jsx(Tile, {
						icon: /* @__PURE__ */ jsx(FileText, { className: "h-5 w-5" }),
						label: "Fichas"
					}),
					/* @__PURE__ */ jsx(Tile, {
						icon: /* @__PURE__ */ jsx(Sparkles, { className: "h-5 w-5" }),
						label: "Copy"
					})
				]
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "text-xl font-semibold text-foreground",
				children: "Painel de Artefatos"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 max-w-sm text-sm",
				children: "Peça um e-mail, banner ou post no chat. O resultado aparece aqui — clique em qualquer texto para editar diretamente."
			})
		]
	});
}
function Tile({ icon, label }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-foreground",
		children: [icon, label]
	});
}
function LoadingState({ intent }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-full flex-col items-center justify-center gap-6 px-8 text-center",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "relative h-16 w-16",
				children: [
					/* @__PURE__ */ jsx("div", { className: "absolute inset-0 animate-ping rounded-full bg-primary/30" }),
					/* @__PURE__ */ jsx("div", { className: "absolute inset-2 rounded-full bg-primary/60" }),
					/* @__PURE__ */ jsx(Sparkles, { className: "absolute inset-0 m-auto h-7 w-7 text-primary-foreground" })
				]
			}),
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
				className: "font-medium text-foreground",
				children: {
					image: "Gerando imagem…",
					email: "Compondo e-mail…",
					datasheet: "Estruturando ficha…",
					text: "Escrevendo conteúdo…"
				}[intent]
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Isso pode levar alguns segundos."
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "w-full max-w-sm space-y-2",
				children: [
					/* @__PURE__ */ jsx("div", { className: "h-3 animate-pulse rounded bg-muted" }),
					/* @__PURE__ */ jsx("div", { className: "h-3 w-5/6 animate-pulse rounded bg-muted" }),
					/* @__PURE__ */ jsx("div", { className: "h-3 w-3/4 animate-pulse rounded bg-muted" })
				]
			})
		]
	});
}
//#endregion
//#region src/components/ThreadList.tsx
function ThreadList({ threads, activeId, onNew, onDelete }) {
	const navigate = useNavigate();
	return /* @__PURE__ */ jsxs("aside", {
		className: "flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2 px-4 py-4",
				children: [/* @__PURE__ */ jsx("div", {
					className: "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground",
					children: /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" })
				}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm font-semibold leading-none",
					children: "Marketing AI"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Studio de artefatos"
				})] })]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-3",
				children: /* @__PURE__ */ jsxs(Button, {
					onClick: onNew,
					className: "w-full justify-start gap-2",
					variant: "secondary",
					children: [/* @__PURE__ */ jsx(MessageSquarePlus, { className: "h-4 w-4" }), "Nova conversa"]
				})
			}),
			/* @__PURE__ */ jsxs("nav", {
				className: "thin-scroll mt-4 flex-1 space-y-1 overflow-y-auto px-2 pb-4",
				children: [threads.length === 0 && /* @__PURE__ */ jsx("p", {
					className: "px-3 py-6 text-center text-xs text-muted-foreground",
					children: "Nenhuma conversa ainda."
				}), threads.map((t) => {
					const active = t.id === activeId;
					return /* @__PURE__ */ jsxs("div", {
						className: `group flex items-center gap-1 rounded-lg pr-1 transition ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`,
						children: [/* @__PURE__ */ jsx(Link, {
							to: "/chat/$threadId",
							params: { threadId: t.id },
							className: "flex-1 truncate px-3 py-2 text-sm",
							children: t.title || "Sem título"
						}), /* @__PURE__ */ jsx("button", {
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								if (!confirm("Excluir esta conversa?")) return;
								onDelete(t.id);
								if (active) navigate({ to: "/" });
							},
							className: "invisible rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive group-hover:visible",
							"aria-label": "Excluir conversa",
							children: /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5" })
						})]
					}, t.id);
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "border-t border-sidebar-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground",
				children: "Ollama local · Pollinations.ai · Histórico salvo no navegador"
			})
		]
	});
}
//#endregion
//#region src/lib/agent.ts
function detectIntent(prompt) {
	const p = prompt.toLowerCase();
	if (/\b(banner|banners)\b/.test(p)) return "banner";
	if (/\b(instagram|insta|post\s+ig|post\s+insta|reel)\b/.test(p)) return "instagram";
	if (/\b(imagem|imagens|foto|ilustra|art\s?work|logo|visual|criativo|gere\s+uma\s+imagem)\b/.test(p)) return "image";
	if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
	if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p)) return "datasheet";
	return "text";
}
/**
* callOllama — chama a Server Function /api/chat com streaming.
* Cada token recebido dispara onToken; ao final dispara onDone.
* Retorna uma função de cancelamento (abort).
*/
function callOllama(prompt, intent, callbacks, signal) {
	const controller = new AbortController();
	if (signal) signal.addEventListener("abort", () => controller.abort());
	let fullText = "";
	(async () => {
		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt,
					intent
				}),
				signal: controller.signal
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
				callbacks.onError(err.error ?? `HTTP ${res.status}`);
				return;
			}
			if (!res.body) {
				callbacks.onError("Resposta sem corpo do servidor.");
				return;
			}
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const payload = line.slice(6).trim();
					if (payload === "[DONE]") {
						callbacks.onDone(fullText);
						return;
					}
					try {
						const token = JSON.parse(payload);
						fullText += token;
						callbacks.onToken(token);
					} catch {}
				}
			}
			callbacks.onDone(fullText);
		} catch (err) {
			if (err.name === "AbortError") return;
			callbacks.onError(err instanceof Error ? err.message : "Erro desconhecido");
		}
	})();
	return () => controller.abort();
}
/**
* translatePromptForImage — chama /api/translate para converter
* o briefing em PT para um prompt em inglês antes do Pollinations.
*/
async function translatePromptForImage(prompt, signal) {
	try {
		const res = await fetch("/api/translate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt }),
			signal
		});
		if (!res.ok) return prompt;
		const { englishPrompt } = await res.json();
		return englishPrompt ?? prompt;
	} catch {
		return prompt;
	}
}
function buildPollinationsUrl(prompt, opts = {}) {
	const { width = 1024, height = 1024, seed } = opts;
	const encoded = encodeURIComponent(prompt);
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
		nologo: "true"
	});
	if (seed !== void 0) params.set("seed", String(seed));
	return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}
function looksLikeHtml(text) {
	return /<!doctype html|<html[\s>]|<body[\s>]|<table[\s>]|<div[\s>]/i.test(text);
}
//#endregion
//#region src/components/ui/sonner.tsx
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ jsx(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
//#endregion
//#region src/routes/chat.$threadId.tsx?tsr-split=component
function generateId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.random() * 16 | 0;
		return (c === "x" ? r : r & 3 | 8).toString(16);
	});
}
function ChatRoute() {
	const { threadId } = useParams({ from: "/chat/$threadId" });
	const navigate = useNavigate();
	const [threads, setThreads] = useState([]);
	const [thread, setThread] = useState();
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [loadingIntent, setLoadingIntent] = useState();
	const abortRef = useRef(null);
	useEffect(() => {
		setThreads(listThreads());
		const t = getThread(threadId);
		if (!t) {
			navigate({
				to: "/chat/$threadId",
				params: { threadId: createThread().id },
				replace: true
			});
			return;
		}
		setThread(t);
	}, [threadId, navigate]);
	const refresh = useCallback(() => {
		setThreads(listThreads());
		setThread(getThread(threadId));
	}, [threadId]);
	const lastArtifact = useMemo(() => {
		if (!thread) return void 0;
		for (let i = thread.messages.length - 1; i >= 0; i--) {
			const a = thread.messages[i].artifact;
			if (a) return a;
		}
	}, [thread]);
	const streamingArtifact = useMemo(() => {
		if (!isStreaming || !streamingText) return void 0;
		if (loadingIntent === "email" || loadingIntent === "banner" || loadingIntent === "instagram" || looksLikeHtml(streamingText)) return {
			kind: "html",
			html: extractHtml(streamingText),
			title: "A gerar..."
		};
		return {
			kind: "markdown",
			markdown: streamingText,
			title: loadingIntent === "datasheet" ? "Ficha Técnica (a gerar...)" : "Conteúdo (a gerar...)"
		};
	}, [
		isStreaming,
		streamingText,
		loadingIntent
	]);
	const panelArtifact = isStreaming ? streamingArtifact : lastArtifact;
	const handleSend = useCallback(async (text) => {
		if (!thread) return;
		const userMsg = {
			id: generateId(),
			role: "user",
			content: text,
			createdAt: Date.now()
		};
		appendMessage(thread.id, userMsg);
		refresh();
		const intent = detectIntent(text);
		setIsStreaming(true);
		setStreamingText("");
		setLoadingIntent(intent);
		const assistantId = generateId();
		const placeholder = {
			id: assistantId,
			role: "assistant",
			content: "",
			createdAt: Date.now()
		};
		appendMessage(thread.id, placeholder);
		refresh();
		try {
			if (intent === "image") {
				const abortCtrl = new AbortController();
				abortRef.current = () => abortCtrl.abort();
				const englishPrompt = await translatePromptForImage(text, abortCtrl.signal);
				const url = buildPollinationsUrl(englishPrompt, { seed: Math.floor(Math.random() * 1e6) });
				await new Promise((resolve, reject) => {
					const img = new Image();
					img.onload = () => resolve();
					img.onerror = () => reject(/* @__PURE__ */ new Error("Falha ao carregar imagem do Pollinations"));
					img.src = url;
				});
				updateMessage(thread.id, assistantId, {
					content: "🖼️ Imagem gerada! Veja a prévia no painel ao lado.",
					artifact: {
						kind: "image",
						url,
						prompt: englishPrompt
					}
				});
				setIsStreaming(false);
				setLoadingIntent(void 0);
				abortRef.current = null;
				refresh();
			} else abortRef.current = callOllama(text, intent, {
				onToken: (token) => {
					setStreamingText((prev) => prev + token);
				},
				onDone: (fullText) => {
					let artifact;
					let reply;
					if (intent === "banner" || intent === "instagram" || intent === "email" || looksLikeHtml(fullText)) {
						const html = extractHtml(fullText);
						const title = {
							banner: "Banner",
							instagram: "Post Instagram",
							email: "E-mail HTML"
						}[intent] ?? "HTML";
						artifact = {
							kind: "html",
							html,
							title
						};
						reply = `✅ ${title} pronto! Veja a prévia e copie o código no painel ao lado.`;
					} else if (intent === "datasheet") {
						artifact = {
							kind: "markdown",
							markdown: fullText,
							title: "Ficha Técnica"
						};
						reply = "✅ Ficha técnica gerada! Use **Exportar PDF** no painel ao lado.";
					} else {
						artifact = {
							kind: "markdown",
							markdown: fullText
						};
						reply = "✅ Conteúdo pronto! Veja o resultado completo no painel ao lado.";
					}
					updateMessage(thread.id, assistantId, {
						content: reply,
						artifact
					});
					setIsStreaming(false);
					setStreamingText("");
					setLoadingIntent(void 0);
					abortRef.current = null;
					refresh();
				},
				onError: (msg) => {
					updateMessage(thread.id, assistantId, { content: `⚠️ ${msg}` });
					toast.error(msg);
					setIsStreaming(false);
					setStreamingText("");
					setLoadingIntent(void 0);
					abortRef.current = null;
					refresh();
				}
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Erro desconhecido";
			updateMessage(thread.id, assistantId, { content: `⚠️ ${msg}` });
			toast.error(msg);
			setIsStreaming(false);
			setStreamingText("");
			setLoadingIntent(void 0);
			abortRef.current = null;
			refresh();
		}
	}, [thread, refresh]);
	const handleStop = useCallback(() => {
		abortRef.current?.();
	}, []);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-screen w-screen overflow-hidden",
		children: [
			/* @__PURE__ */ jsx(ThreadList, {
				threads,
				activeId: threadId,
				onNew: useCallback(() => {
					navigate({
						to: "/chat/$threadId",
						params: { threadId: createThread().id }
					});
				}, [navigate]),
				onDelete: useCallback((id) => {
					deleteThread(id);
					refresh();
				}, [refresh])
			}),
			/* @__PURE__ */ jsxs("main", {
				className: "grid flex-1 grid-cols-1 lg:grid-cols-[minmax(380px,1fr)_minmax(420px,1.2fr)]",
				children: [/* @__PURE__ */ jsx("section", {
					className: "flex h-screen flex-col border-r border-border bg-background/40",
					children: /* @__PURE__ */ jsx(ChatPanel, {
						messages: thread?.messages ?? [],
						streamingText: "",
						onSend: handleSend,
						onStop: handleStop,
						isStreaming
					})
				}), /* @__PURE__ */ jsx("section", {
					className: "hidden h-screen flex-col bg-card/30 lg:flex",
					children: /* @__PURE__ */ jsx(ArtifactPanel, {
						artifact: panelArtifact,
						loading: isStreaming && !streamingText,
						loadingIntent
					})
				})]
			}),
			/* @__PURE__ */ jsx(Toaster$1, {
				richColors: true,
				position: "top-right"
			})
		]
	});
}
function extractHtml(raw) {
	const fence = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
	if (fence) return fence[1].trim();
	return raw.trim();
}
//#endregion
export { ChatRoute as component };

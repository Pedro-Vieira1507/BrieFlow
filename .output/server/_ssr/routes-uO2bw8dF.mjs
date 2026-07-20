import { n as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, r as Slot, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as getServerFnById } from "../__23tanstack-start-server-fn-resolver-C7yDysK1.mjs";
import { c as createServerFn, i as TSS_SERVER_FUNCTION } from "./createServerFn-CIHAFgYl.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as RefreshCw, c as LoaderCircle, d as Ellipsis, f as ChartNoAxesColumnIncreasing, i as Save, l as Heart, m as ArrowRight, n as Sparkles, o as Moon, p as Bookmark, r as Send, s as MessageCircle, t as Sun, u as Globe } from "../_libs/lucide-react.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-uO2bw8dF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
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
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
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
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Textarea.displayName = "Textarea";
var LOADING_MESSAGES = [
	"Lendo o briefing...",
	"Analisando a marca...",
	"Estruturando a conversa...",
	"Preparando a próxima pergunta..."
];
var SUGGESTIONS = [
	"Quero um banner e um post para o lançamento do meu produto: https://",
	"Preciso de um e-mail marketing de reativação de clientes.",
	"Monte uma campanha completa (banner + e-mail + post) a partir do meu site."
];
var formatMarkdown = (text) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { dangerouslySetInnerHTML: { __html: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n/g, "<br/>") } });
};
function ChatPanel({ messages, onSend, loading, brandContext, scraping }) {
	const [input, setInput] = (0, import_react.useState)("");
	const bottomRef = (0, import_react.useRef)(null);
	const inputRef = (0, import_react.useRef)(null);
	const [loadingTextIndex, setLoadingTextIndex] = (0, import_react.useState)(0);
	const userTurns = messages.filter((m) => m.role === "user").length;
	const currentStep = Math.min(5, userTurns + 1);
	const isBusy = loading || !!scraping;
	(0, import_react.useEffect)(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [
		messages,
		loading,
		scraping
	]);
	(0, import_react.useEffect)(() => {
		let interval;
		if (isBusy) interval = setInterval(() => {
			setLoadingTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
		}, 2500);
		else {
			setLoadingTextIndex(0);
			if (messages.length > 0) inputRef.current?.focus();
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [isBusy, messages.length]);
	const submitChat = () => {
		const t = input.trim();
		if (!t || isBusy) return;
		onSend(t);
		setInput("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col bg-surface dark:bg-[#09090b] transition-colors",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border/50 px-6 py-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid size-10 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50",
						children: "BrieFlow Creative"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium text-slate-500 dark:text-slate-400",
						children: "Agente de peças de marketing"
					})] })]
				}), messages.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-end gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[10px] font-bold uppercase tracking-widest text-slate-400",
						children: [
							"Briefing ",
							currentStep,
							"/5"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							1,
							2,
							3,
							4,
							5
						].map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-1.5 w-4 rounded-full ${step <= currentStep ? "bg-slate-900 dark:bg-white" : "bg-slate-200 dark:bg-slate-800"}` }, step))
					})]
				})]
			}),
			brandContext.site && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 border-b border-border/40 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-2 text-[11px] text-emerald-800 dark:text-emerald-300",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "truncate",
					children: [
						"Site analisado:",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: brandContext.site.brandName || brandContext.site.title }),
						" · ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "opacity-80",
							children: brandContext.site.url
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8",
				children: [
					messages.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center mt-10",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-8 text-slate-700 dark:text-slate-200" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-2xl font-display font-bold text-foreground tracking-tight mb-2",
								children: "Criação de Peças Premium"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground mb-8 max-w-sm",
								children: "Sou seu diretor de criação. Conte o objetivo, cole o site da marca e eu monto banners, posts e e-mails no painel ao lado."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col gap-3 w-full max-w-md",
								children: SUGGESTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => onSend(s),
									className: "text-[13px] text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 shadow-sm",
									children: [
										"“",
										s,
										"”"
									]
								}, s))
							})
						]
					}),
					messages.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: m.role === "user" ? "flex justify-end" : "flex justify-start",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 dark:bg-slate-100 px-5 py-3 text-[14px] leading-relaxed text-white dark:text-slate-900 shadow-md" : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-4 text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 shadow-sm",
							children: formatMarkdown(m.content)
						})
					}, m.id)),
					scraping && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-start animate-in fade-in",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-4 animate-pulse text-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-medium text-slate-500 uppercase tracking-widest",
								children: "Acessando e analisando o site..."
							})]
						})
					}),
					loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-start animate-in fade-in",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-1.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "typing-dot size-1.5 rounded-full bg-slate-400" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "typing-dot size-1.5 rounded-full bg-slate-400",
										style: { animationDelay: "0.15s" }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "typing-dot size-1.5 rounded-full bg-slate-400",
										style: { animationDelay: "0.3s" }
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-medium text-slate-500 uppercase tracking-widest",
								children: LOADING_MESSAGES[loadingTextIndex]
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: bottomRef,
						className: "h-4"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border/50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md p-4 md:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:focus-within:ring-white/20 transition-all",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						ref: inputRef,
						value: input,
						onChange: (e) => setInput(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submitChat();
							}
						},
						placeholder: "Descreva a peça, cole o site da marca ou responda ao briefing...",
						rows: 2,
						className: "min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 text-[14px] leading-relaxed p-4",
						disabled: isBusy
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon",
						onClick: submitChat,
						disabled: isBusy || !input.trim(),
						className: "absolute right-3 bottom-3 size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm hover:scale-105 transition-transform",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-center text-[10px] text-muted-foreground",
					children: "Dica: cole uma URL e o agente acessa o site para extrair identidade da marca."
				})]
			})
		]
	});
}
function Editable({ value, onChange, as: Tag = "p", className, multiline = false, placeholder }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (ref.current && ref.current.innerText !== value) ref.current.innerText = value;
	}, [value]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
		ref,
		contentEditable: true,
		suppressContentEditableWarning: true,
		"data-placeholder": placeholder,
		onBlur: (e) => onChange(e.target.innerText),
		onKeyDown: (e) => {
			if (!multiline && e.key === "Enter") {
				e.preventDefault();
				e.target.blur();
			}
		},
		className: `editable-hover focus:outline-brand focus:outline-2 focus:outline-dashed focus:bg-brand/5 ${className ?? ""}`
	});
}
function buildPollinationsUrl(prompt, opts = {}) {
	const { width = 1080, height = 1080, seed } = opts;
	const fullPrompt = `${prompt.trim()}, premium commercial photography, cinematic lighting, high-end advertising aesthetic, ultra sharp, 8k, professional brand campaign, no text, no watermark, no logo`;
	const encoded = encodeURIComponent(fullPrompt);
	const params = new URLSearchParams({
		model: "flux",
		enhance: "true",
		nologo: "true",
		private: "true",
		width: String(width),
		height: String(height)
	});
	if (seed !== void 0) params.set("seed", String(seed));
	return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}
function EmailPreview({ state, onChange }) {
	const [loading, setLoading] = (0, import_react.useState)(true);
	const paragraphs = (state.body ?? "").split(/\n\n+/).filter(Boolean);
	const heroUrl = (0, import_react.useMemo)(() => state.emailHeroImagePrompt ? buildPollinationsUrl(state.emailHeroImagePrompt, {
		width: 1200,
		height: 600,
		seed: state.imageSeed
	}) : null, [state.emailHeroImagePrompt, state.imageSeed]);
	(0, import_react.useEffect)(() => {
		if (heroUrl) setLoading(true);
	}, [heroUrl]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0c0c0e]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-3 rounded-full bg-red-400" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-3 rounded-full bg-amber-400" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-3 rounded-full bg-emerald-400" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "ml-2 text-[12px] text-slate-500 font-medium truncate flex-1 text-center",
				children: [
					"Assunto: ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-slate-800 dark:text-slate-300 font-semibold",
						children: state.title
					}),
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "opacity-50 ml-2",
						children: ["- ", state.preheader]
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-1 md:p-6 bg-slate-50 dark:bg-[#040405]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white dark:bg-black rounded-lg shadow-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-col items-center justify-center py-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-2xl font-display font-black tracking-tighter text-slate-900 dark:text-white uppercase",
							children: "Sua Marca."
						})
					}),
					heroUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative aspect-[2/1] w-full bg-slate-100 dark:bg-slate-900",
						children: [loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute inset-0 flex items-center justify-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-6 animate-spin text-slate-300" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: heroUrl,
							alt: "Hero",
							onLoad: () => setLoading(false),
							className: "h-full w-full object-cover"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-6 px-8 py-10 md:px-12",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
								as: "h1",
								value: state.title ?? "Título do E-mail",
								onChange: (v) => onChange({ title: v }),
								className: "text-balance font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl text-center"
							}),
							state.subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
								as: "p",
								value: state.subtitle,
								onChange: (v) => onChange({ subtitle: v }),
								className: "text-sm font-semibold uppercase tracking-widest text-brand text-center"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-5 pt-4 text-center",
								children: paragraphs.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
									as: "p",
									multiline: true,
									value: p,
									onChange: (v) => {
										const next = [...paragraphs];
										next[i] = v;
										onChange({ body: next.join("\n\n") });
									},
									className: "text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
								}, i))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pt-8 pb-4 flex justify-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "h-12 w-full max-w-xs rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-[1.02] transition-transform shadow-lg",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
										as: "span",
										value: state.cta ?? "Acessar Agora",
										onChange: (v) => onChange({ cta: v })
									})
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20 px-8 py-10 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
							as: "p",
							value: state.footerText ?? "Você recebeu este e-mail porque se cadastrou em nossa lista.",
							onChange: (v) => onChange({ footerText: v }),
							className: "text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-600"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-[11px] text-slate-400 dark:text-slate-600 underline cursor-pointer hover:text-slate-500",
							children: "Descadastrar-se"
						})]
					})
				]
			})
		})]
	});
}
function SocialPreview({ state, onChange }) {
	const [loading, setLoading] = (0, import_react.useState)(true);
	const url = (0, import_react.useMemo)(() => state.imagePrompt ? buildPollinationsUrl(state.imagePrompt, {
		width: 1080,
		height: 1350,
		seed: state.imageSeed
	}) : null, [state.imagePrompt, state.imageSeed]);
	(0, import_react.useEffect)(() => {
		if (url) setLoading(true);
	}, [url]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto max-w-[400px]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-black",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "size-8 rounded-full bg-gradient-to-tr from-amber-400 to-fuchsia-600 flex items-center justify-center p-[2px]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-full rounded-full bg-white dark:bg-black border border-transparent" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[13px] font-semibold text-slate-900 dark:text-white tracking-tight",
							children: "Sua Marca"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-5 text-slate-500" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative aspect-[4/5] w-full bg-slate-100 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-900",
					children: url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-6 animate-spin text-slate-400" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: url,
						alt: state.imagePrompt,
						onLoad: () => setLoading(false),
						className: "h-full w-full object-cover"
					}, url)] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-full items-center justify-center text-sm text-muted-foreground",
						children: "Gerando visual..."
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-6 text-slate-900 dark:text-white" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-6 text-slate-900 dark:text-white" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-6 text-slate-900 dark:text-white" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "size-6 text-slate-900 dark:text-white" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-4 pb-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] font-semibold mb-1 text-slate-900 dark:text-white",
							children: "1,245 curtidas"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[13px] text-slate-900 dark:text-slate-100",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold mr-2",
								children: "Sua Marca"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
								as: "span",
								multiline: true,
								value: state.caption ?? "Escreva a legenda incrível aqui...",
								onChange: (v) => onChange({ caption: v }),
								className: "leading-relaxed whitespace-pre-wrap break-words"
							})]
						}),
						state.hashtags && state.hashtags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
							as: "p",
							value: state.hashtags.join(" "),
							onChange: (v) => onChange({ hashtags: v.split(/\s+/).filter(Boolean) }),
							className: "text-[13px] text-blue-900 dark:text-blue-400 mt-2 break-words"
						})
					]
				})
			]
		})
	});
}
function BannerPreview({ state, onChange }) {
	const [loading, setLoading] = (0, import_react.useState)(true);
	const url = (0, import_react.useMemo)(() => state.imagePrompt ? buildPollinationsUrl(state.imagePrompt, {
		width: 1200,
		height: 400,
		seed: state.imageSeed
	}) : null, [state.imagePrompt, state.imageSeed]);
	(0, import_react.useEffect)(() => {
		if (url) setLoading(true);
	}, [url]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full flex-col space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative flex aspect-[21/9] md:aspect-[3/1] min-h-[250px] w-full shrink-0 overflow-hidden rounded-2xl bg-[#0a0a0c] shadow-2xl ring-1 ring-border/50",
			children: url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-md",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-8 animate-spin text-white/50" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: url,
					alt: state.imagePrompt,
					onLoad: () => setLoading(false),
					onError: () => setLoading(false),
					className: "absolute inset-0 h-full w-full object-cover object-right"
				}, url),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/90 via-40% to-transparent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-20 flex h-full w-full max-w-[60%] md:max-w-[50%] flex-col justify-center px-6 md:px-12 lg:px-16 overflow-hidden",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
							as: "h2",
							value: state.title ?? "Título",
							onChange: (v) => onChange({ title: v }),
							className: "mb-2 line-clamp-3 break-words text-balance font-display text-2xl font-black leading-[1.1] tracking-tight text-white drop-shadow-lg md:text-4xl lg:text-5xl"
						}),
						state.subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
							as: "p",
							value: state.subtitle,
							onChange: (v) => onChange({ subtitle: v }),
							className: "mb-6 line-clamp-3 max-w-sm text-balance font-sans text-xs font-medium leading-relaxed text-slate-300 drop-shadow-md md:text-sm lg:text-base"
						}),
						state.cta && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "group relative inline-flex w-fit cursor-pointer items-center rounded-full bg-white px-5 py-2.5 md:px-7 md:py-3.5 font-sans text-[10px] md:text-[13px] font-bold uppercase tracking-widest text-slate-900 shadow-xl transition-all hover:scale-105",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
									as: "span",
									value: state.cta,
									onChange: (v) => onChange({ cta: v }),
									className: "mr-2 line-clamp-1"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {
									className: "size-3.5 transition-transform group-hover:translate-x-1 md:size-4",
									strokeWidth: 2.5
								})]
							})
						})
					]
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full w-full items-center justify-center text-sm text-slate-500",
				children: "Gerando visual..."
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between rounded-xl border border-border/50 bg-background p-3 opacity-60 hover:opacity-100",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 truncate pr-3 text-[10px] text-muted-foreground uppercase tracking-widest",
				children: ["Art Direction: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-foreground lowercase normal-case",
					children: state.imagePrompt
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "ghost",
				className: "h-7 text-xs",
				onClick: () => {
					setLoading(true);
					onChange({ imageSeed: Math.floor(Math.random() * 1e6) });
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 size-3" }), " Retry Image"]
			})]
		})]
	});
}
var supabaseUrl = "https://ushsfrhavhbqsctebaiu.supabase.co";
var supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzaHNmcmhhdmhicXNjdGViYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwOTMzNTQsImV4cCI6MjA5OTY2OTM1NH0.rjmT0tXte9Jk4L2wOuaQ6k-fc_8yvfx11wYjpaH7ffU";
var isSupabaseConfigured = Boolean(supabaseAnonKey);
var supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
async function saveAssetToLibrary(name, state) {
	if (!supabase) throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
	const { data, error } = await supabase.from("assets").insert([{
		name,
		type: state.type,
		content: state,
		status: "draft"
	}]).select().single();
	if (error) {
		console.error("Erro ao salvar asset:", error);
		throw error;
	}
	return data;
}
var Tabs = Root2;
var TabsList = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
	ref,
	className: cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className),
	...props
}));
TabsList.displayName = List.displayName;
var TabsTrigger = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
	ref,
	className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow", className),
	...props
}));
TabsTrigger.displayName = Trigger.displayName;
var TabsContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
	ref,
	className: cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className),
	...props
}));
TabsContent.displayName = Content.displayName;
var safeRenderText = (content) => {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (typeof content === "object" && content !== null) return Object.entries(content).map(([, v]) => `• ${String(v)}`).join("\n");
	return String(content);
};
function AssetPreview({ type, content, onChange }) {
	if (type === "email") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmailPreview, {
		state: content,
		onChange
	});
	if (type === "banner") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BannerPreview, {
		state: content,
		onChange
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SocialPreview, {
		state: content,
		onChange
	});
}
function CampaignTabs({ assets, onAssetChange }) {
	const hasBanner = assets.some((a) => a.type === "banner");
	const hasEmail = assets.some((a) => a.type === "email");
	const hasSocial = assets.some((a) => a.type === "social");
	const [activeTab, setActiveTab] = (0, import_react.useState)(assets.find((a) => a.type === "banner")?.type || assets.find((a) => a.type === "email")?.type || assets.find((a) => a.type === "social")?.type || "banner");
	(0, import_react.useEffect)(() => {
		const latest = assets[assets.length - 1];
		if (latest) setActiveTab(latest.type);
	}, [assets.length]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		value: activeTab,
		onValueChange: setActiveTab,
		className: "w-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
			className: "grid w-full grid-cols-3 h-14 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl mb-6 shadow-inner",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
					value: "banner",
					disabled: !hasBanner,
					className: "rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40",
					children: hasBanner ? "Banner" : "Banner..."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
					value: "email",
					disabled: !hasEmail,
					className: "rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40",
					children: hasEmail ? "E-mail Mkt" : "E-mail..."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
					value: "social",
					disabled: !hasSocial,
					className: "rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40",
					children: hasSocial ? "Post Social" : "Social..."
				})
			]
		}), assets.map((asset) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
			value: asset.type,
			className: "animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0 w-full",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-4 sm:p-8 border border-border/60 rounded-3xl bg-white dark:bg-[#0c0c0e] shadow-sm relative group overflow-hidden w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetPreview, {
					type: asset.type,
					content: asset.content,
					onChange: (patch) => onAssetChange(asset.id, patch)
				})
			})
		}, asset.id))]
	});
}
function PageBuilder({ state, onChange, loading, onRefine, scores, generatingLabel }) {
	const isSaveable = state.type !== "none" && state.type !== "discovery_plan" && (state.type === "campaign" ? Boolean(state.campaignAssets?.length) : true);
	const [isSaving, setIsSaving] = (0, import_react.useState)(false);
	const [isDarkMode, setIsDarkMode] = (0, import_react.useState)(false);
	const [isGeneratingCampaign, setIsGeneratingCampaign] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (isDarkMode) document.documentElement.classList.add("dark");
		else document.documentElement.classList.remove("dark");
	}, [isDarkMode]);
	(0, import_react.useEffect)(() => {
		if (!loading) setIsGeneratingCampaign(false);
	}, [loading]);
	const handleSaveToLibrary = async () => {
		if (!isSupabaseConfigured) return toast.error("Biblioteca não configurada (Supabase).");
		const name = state.title || state.campaignAssets?.[0]?.content?.title || state.discoveryPlan?.brandName || "Peça BrieFlow";
		setIsSaving(true);
		try {
			await saveAssetToLibrary(name, state);
			toast.success("Ativo salvo na biblioteca!");
		} catch {
			toast.error("Erro ao salvar o ativo.");
		} finally {
			setIsSaving(false);
		}
	};
	const handleAssetChange = (assetId, patch) => {
		onChange({ campaignAssets: (state.campaignAssets ?? []).map((asset) => asset.id === assetId ? {
			...asset,
			content: {
				...asset.content,
				...patch
			}
		} : asset) });
	};
	const showSingleAsset = state.type === "email" || state.type === "social" || state.type === "banner";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col relative bg-background transition-colors",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-8 py-5 backdrop-blur-md z-10 sticky top-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "truncate font-display text-lg font-bold tracking-tight text-foreground",
						children: "Painel de Peças"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-xs font-medium text-muted-foreground",
						children: "Preview premium em tempo real"
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						onClick: () => setIsDarkMode(!isDarkMode),
						className: "rounded-full",
						children: isDarkMode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" })
					}),
					scores && isSaveable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden md:flex items-center gap-4 mx-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-x border-border/50 px-4 h-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartNoAxesColumnIncreasing, { className: "size-3.5 text-emerald-500" }),
								" ",
								scores.persuasion
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartNoAxesColumnIncreasing, { className: "size-3.5 text-blue-500" }),
								" ",
								scores.clarity
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						size: "sm",
						disabled: !isSaveable || loading || isSaving,
						onClick: handleSaveToLibrary,
						className: "font-semibold shadow-sm border-border disabled:opacity-30",
						children: [isSaving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-2 size-4" }), "Salvar"]
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040405] p-6 lg:p-12 relative transition-colors ${loading && state.type === "discovery_plan" && !isGeneratingCampaign ? "opacity-60 pointer-events-none" : ""}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto max-w-5xl",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-12",
					children: [
						loading && generatingLabel && state.type === "campaign" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-center gap-3 rounded-2xl border border-border/50 bg-white/80 dark:bg-slate-900/80 px-6 py-4 shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin text-slate-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium text-slate-600 dark:text-slate-300",
								children: generatingLabel
							})]
						}),
						state.type === "campaign" && state.campaignAssets && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-8 animate-in fade-in duration-700",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center space-y-2 mb-8",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-3xl font-bold tracking-tight text-foreground",
									children: "Peças da Campanha"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-sm",
									children: "Qualidade premium — clique nos textos para editar."
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CampaignTabs, {
								assets: state.campaignAssets,
								onAssetChange: handleAssetChange
							})]
						}),
						showSingleAsset && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-6 animate-in fade-in duration-500",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center space-y-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-2xl font-bold tracking-tight capitalize",
									children: state.type === "email" ? "E-mail Marketing" : state.type === "social" ? "Post Social" : "Banner"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-4 sm:p-8 border border-border/60 rounded-3xl bg-white dark:bg-[#0c0c0e] shadow-sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetPreview, {
									type: state.type,
									content: state,
									onChange
								})
							})]
						}),
						state.type === "discovery_plan" && state.discoveryPlan && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mx-auto w-full max-w-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-8 flex flex-col items-center justify-center text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mb-4 grid size-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner dark:bg-indigo-950 dark:text-indigo-300",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-8" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "font-display text-2xl font-bold tracking-tight text-foreground",
											children: "Briefing Criativo"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm text-muted-foreground",
											children: "Acompanhe o que o agente coletou. Edite se precisar e aprove para gerar as peças."
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-6 md:grid-cols-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-xs font-bold uppercase tracking-widest text-slate-500 mb-3",
											children: "Contexto consolidado"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
											as: "p",
											multiline: true,
											value: safeRenderText(state.discoveryPlan.detectedContext),
											onChange: (v) => onChange({ discoveryPlan: {
												...state.discoveryPlan,
												detectedContext: v
											} }),
											className: "text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-xs font-bold uppercase tracking-widest text-amber-500 mb-3",
											children: "Ainda em qualificação"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
											as: "p",
											multiline: true,
											value: safeRenderText(state.discoveryPlan.missingInfo),
											onChange: (v) => onChange({ discoveryPlan: {
												...state.discoveryPlan,
												missingInfo: v
											} }),
											className: "text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3",
										children: "Proposta de peças"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editable, {
										as: "p",
										multiline: true,
										value: safeRenderText(state.discoveryPlan.proposedStrategy),
										onChange: (v) => onChange({ discoveryPlan: {
											...state.discoveryPlan,
											proposedStrategy: v
										} }),
										className: "text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
									})]
								}),
								(state.discoveryPlan.brandName || state.discoveryPlan.audience || state.discoveryPlan.offer) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-3 sm:grid-cols-3",
									children: [
										state.discoveryPlan.brandName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "uppercase tracking-widest text-slate-400 mb-1",
												children: "Marca"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-semibold text-foreground",
												children: state.discoveryPlan.brandName
											})]
										}),
										state.discoveryPlan.audience && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "uppercase tracking-widest text-slate-400 mb-1",
												children: "Público"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-semibold text-foreground",
												children: state.discoveryPlan.audience
											})]
										}),
										state.discoveryPlan.offer && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "uppercase tracking-widest text-slate-400 mb-1",
												children: "Oferta"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-semibold text-foreground",
												children: state.discoveryPlan.offer
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end pt-4",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										onClick: () => {
											setIsGeneratingCampaign(true);
											onRefine("Aprovado. Gere os materiais do ecossistema agora. Foque em copy consultiva, elegante e premium.");
										},
										disabled: loading,
										className: "bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-11 px-8 shadow-lg hover:scale-105 transition-transform",
										children: [isGeneratingCampaign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 size-4 animate-spin" }) : null, isGeneratingCampaign ? "Gerando peças premium..." : "Aprovar & Gerar Peças"]
									})
								})
							]
						}),
						state.type === "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {})
					]
				})
			})
		})]
	});
}
function EmptyState() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-[65vh] flex-col items-center justify-center text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-8 grid size-24 place-items-center rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-10" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-display text-2xl font-bold tracking-tight text-foreground",
				children: "Painel pronto"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground",
				children: "Converse com o agente, cole o site da marca e as peças premium (banner, e-mail e posts) aparecerão aqui com qualidade profissional."
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var URL_REGEX = /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|com\.br|io|net|org|app|ai|co|dev|store|shop|me|info|biz)(?:\/[^\s<>"')\]]*)?/gi;
function extractUrlsFromText(text) {
	const normalized = (text.match(URL_REGEX) ?? []).map(normalizeUrl).filter((u) => Boolean(u));
	return [...new Set(normalized)];
}
function normalizeUrl(raw) {
	let value = raw.trim().replace(/[.,;:!?)]+$/, "");
	if (!value) return null;
	if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
	try {
		const url = new URL(value);
		if (!["http:", "https:"].includes(url.protocol)) return null;
		return url.toString();
	} catch {
		return null;
	}
}
function formatSiteContextForAgent(site) {
	return [
		`URL: ${site.url}`,
		`Marca: ${site.brandName}`,
		site.title ? `Título: ${site.title}` : null,
		site.description ? `Descrição: ${site.description}` : null,
		site.keywords ? `Keywords: ${site.keywords}` : null,
		site.headings.length ? `Headings: ${site.headings.slice(0, 6).join(" | ")}` : null,
		site.bodySnippet ? `Conteúdo extraído:\n${site.bodySnippet.slice(0, 1200)}` : null
	].filter(Boolean).join("\n");
}
var scrapeWebsite = createServerFn({ method: "POST" }).validator((data) => {
	if (!data?.url || typeof data.url !== "string") throw new Error("URL obrigatória.");
	const normalized = normalizeUrl(data.url);
	if (!normalized) throw new Error("URL inválida.");
	return { url: normalized };
}).handler(createSsrRpc("bdfb90ff62430c1f7b847286a83a77ca7732c6b5e9ba61a16f7e09e20458552b"));
var DISCOVERY_AGENT_PROMPT = (currentPlan, brandContext) => `Você é o **BrieFlow Creative Director** — um diretor de criação de marketing sênior e conversacional.

Sua missão é COLETAR informações com naturalidade para produzir peças premium:
banners, posts de redes sociais e e-mails marketing.

=== REGRAS DE CONVERSA ===
1. Tom: profissional, criativo, acolhedor e direto. Sem jargão vazio. Sem emojis excessivos (máx 1 se fizer sentido).
2. UMA pergunta por vez. Nunca faça listas de perguntas.
3. Valide a resposta anterior em 1 frase curta antes da próxima pergunta.
4. Se o usuário já trouxe muitas informações de uma vez, avance e preencha o plano.
5. Se houver DADOS DO SITE abaixo, use-os: confirme a marca/produto e não peça o óbvio.

=== DADOS DO SITE (quando disponíveis) ===
${brandContext.site ? formatSiteContextForAgent(brandContext.site) : "Nenhum site analisado ainda. Se o usuário enviar uma URL, peça para colar o link completo."}

=== CONTEXTO DE MARCA ===
Persona: ${brandContext.persona}
Tom desejado: ${brandContext.tone}
Framework: ${brandContext.framework}
${brandContext.brandName ? `Marca: ${brandContext.brandName}` : ""}
${brandContext.product ? `Produto: ${brandContext.product}` : ""}

=== MEMÓRIA DO PLANO ===
${currentPlan ? JSON.stringify(currentPlan) : "Sem dados. Comece pelo Passo 1."}

=== ROTEIRO DE QUALIFICAÇÃO (ordem flexível) ===
Passo 1. Site ou marca/produto (peça a URL se ainda não houver)
Passo 2. Objetivo da peça (lançamento, lead gen, remarketing, awareness, promoção)
Passo 3. Público-alvo (quem deve se sentir representado)
Passo 4. Oferta / CTA principal e canais desejados (banner, e-mail, post — ou todos)
Passo 5. FECHAMENTO: Resuma o briefing em 3–5 linhas e pergunte se pode gerar as peças agora.

Quando chegar no Passo 5:
- missingInfo = "Nenhuma"
- proposedStrategy deve listar exatamente as peças a gerar (ex: "Banner + E-mail + Post Instagram")

SEMPRE responda ESTRITAMENTE em JSON. Nenhum texto fora do JSON.

{
  "chat": "Resposta conversacional (validação + próxima pergunta ou fechamento).",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "Resumo atualizado do que já sabe (marca, produto, site, objetivo).",
      "missingInfo": "O que ainda falta coletar. Se completo: Nenhuma",
      "proposedStrategy": "Peças e ângulo criativo. Se ainda coletando: Aguardando dados...",
      "brandName": "nome da marca se souber",
      "product": "produto/serviço se souber",
      "audience": "público se souber",
      "offer": "oferta/CTA se souber",
      "channels": ["banner", "email", "social"],
      "websiteUrl": "url se houver"
    }
  }
}`;
var EXECUTION_AGENT_PROMPT = (ctx, plan, targetAsset) => `Você é o **BrieFlow Execution Agent** — Diretor de Criação de Marketing Premium.

Gere APENAS a peça solicitada, com qualidade de agência top (copy + direção de arte).

=== BRIEFING APROVADO ===
${plan ? JSON.stringify(plan) : "Use o histórico da conversa."}

=== DADOS DO SITE / MARCA ===
${ctx.site ? formatSiteContextForAgent(ctx.site) : "Sem site. Use o briefing."}
Tom: ${ctx.tone}
Persona: ${ctx.persona}

=== TAREFA ===
GERAR APENAS: ${targetAsset.toUpperCase()}

=== PADRÃO PREMIUM (OBRIGATÓRIO) ===
1. Copy em português do Brasil, elegante, persuasiva, sem clichês ("revolucionário", "melhor do mercado", "não perca").
2. Frases curtas. Benefício > feature. CTA claro e acionável.
3. imagePrompt e emailHeroImagePrompt SEMPRE em INGLÊS, fotográficos/cinemáticos, SEM texto na imagem.
4. Respeite a identidade da marca quando houver site (setor, produto, tom).

${targetAsset === "banner" ? `=== BANNER ===
- title: MÁXIMO 5 palavras, punchy
- subtitle: 1 linha de benefício (máx 18 palavras)
- cta: 2–4 palavras
- imagePrompt fórmula: "[hero subject related to brand] on the far right third, cinematic commercial lighting, [relevant environment], massive empty dark negative space on the left for typography, ultra premium advertising photography, 8k"` : ""}
${targetAsset === "email" ? `=== E-MAIL MARKETING ===
- preheader: 40–80 chars, instigante
- title: assunto/headline forte
- subtitle: opcional, linha de apoio
- body: 2–3 parágrafos curtos separados por \\n\\n (história → valor → CTA)
- cta: botão claro
- footerText: linha legal simples
- emailHeroImagePrompt: fotografia comercial premium em inglês, wide cinematic hero, sem texto` : ""}
${targetAsset === "social" ? `=== POST SOCIAL (Instagram) ===
- caption: 2–4 linhas engajadoras + CTA sutil
- hashtags: array com 3–5 hashtags relevantes (com #)
- imagePrompt: vertical 4:5 commercial photo em inglês, sem texto, estética premium de feed` : ""}

Mantenha raciocínio interno curto se houver tags de thinking.

=== RETORNO (JSON ESTRITO) ===
{
  "chat": "Peça gerada com sucesso. Pode revisar no painel ao lado.",
  "builder": {
    "type": "campaign",
    "campaignAssets": [
       ${targetAsset === "banner" ? `{ "id": "banner-1", "type": "banner", "status": "draft", "content": { "type": "banner", "title": "...", "subtitle": "...", "cta": "...", "imagePrompt": "..." } }` : ""}
       ${targetAsset === "email" ? `{ "id": "email-1", "type": "email", "status": "draft", "content": { "type": "email", "preheader": "...", "emailHeroImagePrompt": "...", "title": "...", "subtitle": "...", "body": "...", "cta": "...", "footerText": "..." } }` : ""}
       ${targetAsset === "social" ? `{ "id": "social-1", "type": "social", "status": "draft", "content": { "type": "social", "caption": "...", "hashtags": ["#a", "#b", "#c"], "imagePrompt": "..." } }` : ""}
    ]
  },
  "scores": { "persuasion": 0-100, "clarity": 0-100, "seo": 0-100 }
}`;
function tryParseJson(text) {
	let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
	cleanText = cleanText.replace(/```json/gi, "").replace(/```/g, "").trim();
	try {
		return JSON.parse(cleanText);
	} catch {
		const match = cleanText.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
}
function resolveOllamaApiUrl() {
	let apiUrl = "http://localhost:11434/api/chat";
	if (typeof window !== "undefined") apiUrl = `${"http://129.213.132.69:11434/api/chat".replace("/v1/chat/completions", "").replace("/api/chat", "")}/api/chat`;
	else apiUrl = `${"http://129.213.132.69:11434/api/chat".replace("/v1/chat/completions", "").replace("/api/chat", "")}/api/chat`;
	return apiUrl;
}
function pickModels(wantsExecution) {
	return wantsExecution ? "qwen3.6:27b" : "qwen2.5:7b";
}
async function sendToOllama(history, brandContext, currentPlan, onStream, targetAsset) {
	const apiUrl = resolveOllamaApiUrl();
	const wantsExecution = !!targetAsset;
	const systemPrompt = wantsExecution ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset) : DISCOVERY_AGENT_PROMPT(currentPlan, brandContext);
	const recentHistory = history.slice(-10);
	const messages = [{
		role: "system",
		content: systemPrompt
	}, ...recentHistory];
	const modelToUse = pickModels(wantsExecution);
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), wantsExecution ? 9e5 : 12e4);
	try {
		const res = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: modelToUse,
				messages,
				stream: true,
				format: "json",
				options: {
					temperature: wantsExecution ? .35 : .55,
					top_p: .9,
					num_predict: wantsExecution ? 4096 : 1200
				}
			}),
			signal: controller.signal
		});
		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			throw new Error(`Ollama HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
		}
		if (!res.body) throw new Error("Streaming não suportado pelo servidor.");
		const reader = res.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let rawJson = "";
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
			for (const line of lines) try {
				const parsed = JSON.parse(line);
				if (parsed.message?.content) {
					rawJson += parsed.message.content;
					if (onStream && !wantsExecution) {
						const chatMatch = rawJson.match(/"chat"\s*:\s*"([\s\S]*?)(?:"\s*,|"\s*\}|$)/);
						if (chatMatch?.[1]) onStream(chatMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
					}
				}
			} catch {}
		}
		clearTimeout(timeoutId);
		const parsed = tryParseJson(rawJson);
		if (!parsed) return {
			chat: "Tive uma oscilação ao processar a resposta. Pode reenviar ou reformular?",
			builder: currentPlan ? {
				type: "discovery_plan",
				discoveryPlan: currentPlan
			} : { type: "none" }
		};
		if (!parsed.builder) parsed.builder = currentPlan ? {
			type: "discovery_plan",
			discoveryPlan: currentPlan
		} : { type: "none" };
		if (!parsed.chat) parsed.chat = wantsExecution ? "Peça gerada. Confira o painel ao lado." : "Pode me contar um pouco mais sobre a campanha?";
		return parsed;
	} catch (err) {
		clearTimeout(timeoutId);
		const error = err;
		if (error.name === "AbortError") throw new Error(wantsExecution ? "A IA demorou demais para criar esta peça. Tente novamente." : "O servidor de IA não respondeu a tempo.");
		throw new Error(`Falha de rede com a IA: ${error.message ?? String(err)}`);
	}
}
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
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
function uid() {
	return Math.random().toString(36).slice(2, 10);
}
function resolveChannels(plan) {
	const raw = plan?.channels?.map((c) => c.toLowerCase()) ?? [];
	const channels = [];
	if (raw.some((c) => c.includes("banner"))) channels.push("banner");
	if (raw.some((c) => c.includes("email") || c.includes("e-mail") || c.includes("mail"))) channels.push("email");
	if (raw.some((c) => c.includes("social") || c.includes("post") || c.includes("instagram"))) channels.push("social");
	if (channels.length === 0) return [
		"banner",
		"email",
		"social"
	];
	return channels;
}
function Home() {
	const [messages, setMessages] = (0, import_react.useState)([]);
	const [builder, setBuilder] = (0, import_react.useState)({ type: "none" });
	const [scores, setScores] = (0, import_react.useState)();
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [scraping, setScraping] = (0, import_react.useState)(false);
	const [generatingLabel, setGeneratingLabel] = (0, import_react.useState)();
	const [brandContext, setBrandContext] = (0, import_react.useState)({
		persona: "Público-alvo da marca",
		tone: "Profissional, premium e persuasivo",
		framework: "AIDA (Atenção, Interesse, Desejo, Ação)"
	});
	const discoveryPlanRef = (0, import_react.useRef)(void 0);
	const brandContextRef = (0, import_react.useRef)(brandContext);
	brandContextRef.current = brandContext;
	const mergeSiteIntoContext = (site) => {
		setBrandContext((prev) => {
			const next = {
				...prev,
				brandName: site.brandName || prev.brandName,
				product: prev.product,
				site,
				persona: prev.persona === "Público-alvo da marca" ? `Pessoas interessadas em ${site.brandName || site.title || "esta marca"}` : prev.persona
			};
			brandContextRef.current = next;
			return next;
		});
	};
	const maybeScrapeUrls = async (text) => {
		const urls = extractUrlsFromText(text);
		if (urls.length === 0) return null;
		const target = urls[0];
		if (brandContextRef.current.site?.url === target) return brandContextRef.current.site;
		setScraping(true);
		try {
			const site = await scrapeWebsite({ data: { url: target } });
			mergeSiteIntoContext(site);
			toast.success(`Site analisado: ${site.brandName || site.title}`);
			return site;
		} catch (err) {
			toast.error(`Não consegui acessar o site: ${err instanceof Error ? err.message : String(err)}`);
			return null;
		} finally {
			setScraping(false);
		}
	};
	const generateCampaignSequentially = async (baseHistory) => {
		setLoading(true);
		const plan = discoveryPlanRef.current ?? builder.discoveryPlan;
		const channels = resolveChannels(plan);
		const stepMeta = {
			banner: {
				label: "Banner",
				prompt: "Aprovado. Crie APENAS a copy e a direção de arte do Banner premium da campanha."
			},
			email: {
				label: "E-mail Marketing",
				prompt: "Excelente. Agora crie APENAS o E-mail Marketing premium desta mesma campanha."
			},
			social: {
				label: "Post Social",
				prompt: "Perfeito. Por fim, crie APENAS o Post para Instagram desta campanha, com legenda e hashtags."
			}
		};
		const steps = channels.map((type) => ({
			type,
			...stepMeta[type]
		}));
		setBuilder((prev) => ({
			...prev,
			type: "campaign",
			campaignAssets: prev.type === "campaign" ? prev.campaignAssets ?? [] : []
		}));
		let currentHistory = [...baseHistory];
		let accumulatedAssets = [];
		for (const step of steps) {
			const assistantId = uid();
			setGeneratingLabel(`Gerando ${step.label} premium...`);
			if (step.type !== steps[0].type) setMessages((prev) => [
				...prev,
				{
					id: uid(),
					role: "user",
					content: step.prompt
				},
				{
					id: assistantId,
					role: "assistant",
					content: `Gerando ${step.label} com qualidade de agência...\n\n(Pode levar alguns minutos)`
				}
			]);
			else setMessages((prev) => [...prev, {
				id: assistantId,
				role: "assistant",
				content: `Briefing aprovado. Gerando ${step.label} premium no painel ao lado...\n\n(Pode levar alguns minutos)`
			}]);
			currentHistory.push({
				role: "user",
				content: step.prompt
			});
			try {
				const res = await sendToOllama(currentHistory, brandContextRef.current, plan, void 0, step.type);
				if (res.builder?.campaignAssets && res.builder.campaignAssets.length > 0) {
					const newAsset = res.builder.campaignAssets[0];
					newAsset.content.imageSeed = Math.floor(Math.random() * 1e6);
					newAsset.content.type = step.type;
					newAsset.type = step.type;
					accumulatedAssets = [...accumulatedAssets, newAsset];
					setBuilder((prev) => ({
						...prev,
						type: "campaign",
						campaignAssets: accumulatedAssets
					}));
				}
				if (res.scores) setScores(res.scores);
				setMessages((prev) => prev.map((m) => m.id === assistantId ? {
					...m,
					content: res.chat
				} : m));
				currentHistory.push({
					role: "assistant",
					content: res.chat
				});
			} catch (err) {
				toast.error(`Falha ao gerar o ${step.label}: ${err instanceof Error ? err.message : err}`);
				break;
			}
		}
		setMessages((prev) => [...prev, {
			id: uid(),
			role: "assistant",
			content: "Estrutura finalizada. Navegue pelas abas no painel ao lado, edite os textos e regenere imagens se quiser."
		}]);
		setGeneratingLabel(void 0);
		setLoading(false);
	};
	const handleSend = async (text, isHiddenAction = false) => {
		const userMsg = {
			id: uid(),
			role: "user",
			content: text
		};
		const nextMessages = isHiddenAction ? messages : [...messages, userMsg];
		if (!isHiddenAction) setMessages(nextMessages);
		if (!isHiddenAction) await maybeScrapeUrls(text);
		if (text.includes("Aprovado. Gere os materiais do ecossistema agora.")) {
			await generateCampaignSequentially(nextMessages.map((m) => ({
				role: m.role,
				content: m.content
			})));
			return;
		}
		const approvalRegex = /\b(aprovado|pode gerar|gera as pe[cç]as|gerar as pe[cç]as|pode criar|vamos gerar|pode montar)\b/i;
		const planReady = discoveryPlanRef.current?.missingInfo?.toLowerCase().includes("nenhum") || builder.discoveryPlan?.missingInfo?.toLowerCase().includes("nenhum");
		if (!isHiddenAction && planReady && approvalRegex.test(text)) {
			await generateCampaignSequentially(nextMessages.map((m) => ({
				role: m.role,
				content: m.content
			})));
			return;
		}
		const assistantId = uid();
		if (!isHiddenAction) setMessages([...nextMessages, {
			id: assistantId,
			role: "assistant",
			content: ""
		}]);
		setLoading(true);
		const history = nextMessages.map((m) => ({
			role: m.role,
			content: m.content
		}));
		if (brandContextRef.current.site && history.length > 0) {
			const last = history[history.length - 1];
			if (last.role === "user") last.content = `${last.content}\n\n[SITE_ANALISADO]\nURL: ${brandContextRef.current.site.url}\nMarca: ${brandContextRef.current.site.brandName}\nTítulo: ${brandContextRef.current.site.title}\nDescrição: ${brandContextRef.current.site.description}`;
		}
		try {
			const res = await sendToOllama(history, brandContextRef.current, discoveryPlanRef.current ?? builder.discoveryPlan, (partialChat) => {
				if (!isHiddenAction) setMessages((prev) => prev.map((m) => m.id === assistantId ? {
					...m,
					content: partialChat
				} : m));
			});
			if (!isHiddenAction) setMessages((prev) => prev.map((m) => m.id === assistantId ? {
				...m,
				content: res.chat
			} : m));
			if (res.builder && res.builder.type !== "none") {
				if (res.builder.type === "discovery_plan" && res.builder.discoveryPlan) {
					discoveryPlanRef.current = res.builder.discoveryPlan;
					setBrandContext((prev) => ({
						...prev,
						brandName: res.builder.discoveryPlan?.brandName || prev.brandName,
						product: res.builder.discoveryPlan?.product || prev.product,
						offer: res.builder.discoveryPlan?.offer || prev.offer,
						persona: res.builder.discoveryPlan?.audience || prev.persona
					}));
				}
				if (res.builder.type === "campaign" && res.builder.campaignAssets?.length) res.builder.campaignAssets = res.builder.campaignAssets.map((a) => ({
					...a,
					content: {
						...a.content,
						imageSeed: a.content.imageSeed ?? Math.floor(Math.random() * 1e6)
					}
				}));
				setBuilder({
					...res.builder,
					imageSeed: Math.floor(Math.random() * 1e6)
				});
			}
			if (res.scores) setScores(res.scores);
		} catch (err) {
			toast.error(`Falha ao conectar: ${err instanceof Error ? err.message : err}`);
			setMessages((prev) => prev.filter((m) => m.id !== assistantId));
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "flex h-1/2 shrink-0 flex-col border-b lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatPanel, {
				messages,
				onSend: (t) => handleSend(t, false),
				loading,
				scraping,
				brandContext,
				setBrandContext
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "flex min-h-0 min-w-0 flex-1 flex-col bg-background relative",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageBuilder, {
				state: builder,
				onChange: (patch) => setBuilder((prev) => ({
					...prev,
					...patch
				})),
				loading,
				onRefine: (prompt) => handleSend(prompt, true),
				scores,
				generatingLabel
			})
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
		richColors: true,
		position: "top-right"
	})] });
}
//#endregion
export { Home as component };

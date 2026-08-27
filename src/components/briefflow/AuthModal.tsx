// src/components/briefflow/AuthModal.tsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setIsLogin(true);
      setShowPassword(false);
    }
  }, [open]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return toast.error("Supabase não conectado.");

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        onOpenChange(false);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Conta criada! Você pode salvar suas artes.");
        onOpenChange(false);
      }
    } catch (error: any) {
      let errorMsg = error.message || "Erro na autenticação.";

      if (errorMsg.includes("Invalid login credentials")) {
        errorMsg = "E-mail ou senha incorretos.";
      } else if (errorMsg.includes("Password should be at least")) {
        errorMsg = "A senha deve ter pelo menos 6 caracteres.";
      } else if (errorMsg.includes("User already registered")) {
        errorMsg = "Este e-mail já está cadastrado.";
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[430px] overflow-hidden rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)] sm:max-w-[430px]">
        <div className="relative border-b border-border-subtle px-6 pb-5 pt-7 sm:px-7">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_25%_0%,rgba(124,105,255,0.18),transparent_70%)]"
          />
          <DialogHeader className="relative text-left">
            <div className="mb-4 grid size-11 place-items-center rounded-2xl border border-brand/20 bg-brand-muted text-brand shadow-[0_16px_45px_-24px_var(--brand-glow)]">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.035em]">
              {isLogin ? "Acessar BrieFlow" : "Criar sua conta"}
            </DialogTitle>
            <DialogDescription className="mt-1.5 max-w-sm text-sm leading-5 text-fg-tertiary">
              {isLogin
                ? "Continue de onde parou e acesse suas campanhas salvas."
                : "Organize suas criações e mantenha o histórico no mesmo lugar."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleAuth}
          className="space-y-4 px-6 pb-6 pt-5 sm:px-7 sm:pb-7"
        >
          <div className="grid grid-cols-2 rounded-xl border border-border-subtle bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`h-9 rounded-lg text-xs font-semibold transition ${isLogin ? "bg-surface-3 text-fg-primary shadow-sm" : "text-fg-tertiary hover:text-fg-primary"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`h-9 rounded-lg text-xs font-semibold transition ${!isLogin ? "bg-surface-3 text-fg-primary shadow-sm" : "text-fg-tertiary hover:text-fg-primary"}`}
            >
              Criar conta
            </button>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs font-semibold text-fg-secondary"
            >
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-border-subtle bg-surface-2 px-3.5 text-fg-primary transition-colors placeholder:text-fg-muted focus-visible:border-brand/50 focus-visible:ring-brand/20"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-fg-secondary"
              >
                Senha
              </Label>
              {!isLogin && (
                <span className="text-[10px] text-fg-muted">
                  Mínimo de 6 caracteres
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-border-subtle bg-surface-2 px-3.5 pr-11 text-fg-primary transition-colors placeholder:text-fg-muted focus-visible:border-brand/50 focus-visible:ring-brand/20"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fg-muted transition hover:bg-surface-3 hover:text-fg-primary"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 w-full rounded-xl bg-brand font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition hover:-translate-y-px hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {loading ? "Processando..." : isLogin ? "Entrar" : "Criar conta"}
          </Button>
          <p className="text-center text-[10px] leading-4 text-fg-muted">
            Ao continuar, você concorda em usar o BrieFlow de forma responsável.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

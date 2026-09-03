import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuthMode = "login" | "signup" | "forgot" | "recovery" | "confirmation";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function AuthModal({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setPassword("");
        onOpenChange(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [onOpenChange]);

  useEffect(() => {
    if (!open && mode !== "recovery") {
      setEmail("");
      setPassword("");
      setMode("login");
      setShowPassword(false);
    }
  }, [open, mode]);

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      toast.error("Autenticação não configurada.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const safeEmail = normalizeEmail(String(formData.get("email") ?? email));
    const submittedPassword = String(formData.get("password") ?? password);
    if (mode !== "recovery" && !safeEmail) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (
      ["signup", "recovery"].includes(mode) &&
      submittedPassword.length < 12
    ) {
      toast.error("Use uma senha com pelo menos 12 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/app?password_recovery=1`;
        const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
          redirectTo,
        });
        if (error) throw error;
        setMode("confirmation");
        toast.success(
          "Se a conta existir, enviaremos as instruções por e-mail.",
        );
        return;
      }

      if (mode === "recovery") {
        const { error } = await supabase.auth.updateUser({
          password: submittedPassword,
        });
        if (error) throw error;
        toast.success("Senha atualizada com segurança.");
        setMode("login");
        setPassword("");
        onOpenChange(false);
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: safeEmail,
          password: submittedPassword,
        });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        onOpenChange(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: safeEmail,
        password: submittedPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) throw error;
      if (!data.session) {
        setMode("confirmation");
        toast.success("Confirme seu e-mail para ativar a conta.");
      } else {
        toast.success("Conta criada com sucesso.");
        onOpenChange(false);
      }
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "Erro na autenticação.";
      const translated = raw.includes("Invalid login credentials")
        ? "E-mail ou senha incorretos."
        : raw.includes("Password should be at least")
          ? "A senha deve ter pelo menos 12 caracteres."
          : raw.includes("User already registered")
            ? "Este e-mail já está cadastrado."
            : "Não foi possível concluir a autenticação. Tente novamente.";
      toast.error(translated);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Criar sua conta"
      : mode === "forgot"
        ? "Recuperar acesso"
        : mode === "recovery"
          ? "Definir nova senha"
          : mode === "confirmation"
            ? "Verifique seu e-mail"
            : "Acessar BrieFlow";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[430px] overflow-hidden rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)] sm:max-w-[430px]">
        <div className="relative border-b border-border-subtle px-6 pb-5 pt-7 sm:px-7">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_25%_0%,rgba(124,105,255,0.18),transparent_70%)]"
          />
          <DialogHeader className="relative text-left">
            <div className="mb-4 grid size-11 place-items-center rounded-2xl border border-brand/20 bg-brand-muted text-brand">
              {mode === "confirmation" ? (
                <MailCheck className="size-5" />
              ) : (
                <Sparkles className="size-5" />
              )}
            </div>
            <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.035em]">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 max-w-sm text-sm leading-5 text-fg-tertiary">
              {mode === "signup" &&
                "Sua biblioteca e seus arquivos ficam privados na sua conta."}
              {mode === "login" &&
                "Continue de onde parou e acesse apenas suas campanhas salvas."}
              {mode === "forgot" &&
                "Enviaremos um link seguro para redefinir sua senha."}
              {mode === "recovery" &&
                "Escolha uma senha forte com no mínimo 12 caracteres."}
              {mode === "confirmation" &&
                "Abra o link que enviamos. Por segurança, não confirmamos se um endereço está cadastrado."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {mode === "confirmation" ? (
          <div className="space-y-3 px-6 py-6 sm:px-7">
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl border-border-strong bg-surface-2"
              onClick={() => setMode("login")}
            >
              Voltar para o login
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleAuth}
            className="space-y-4 px-6 pb-6 pt-5 sm:px-7 sm:pb-7"
          >
            {mode !== "forgot" && mode !== "recovery" ? (
              <div className="grid grid-cols-2 rounded-xl border border-border-subtle bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${mode === "login" ? "bg-surface-3 text-fg-primary shadow-sm" : "text-fg-tertiary"}`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${mode === "signup" ? "bg-surface-3 text-fg-primary shadow-sm" : "text-fg-tertiary"}`}
                >
                  Criar conta
                </button>
              </div>
            ) : null}

            {mode !== "recovery" ? (
              <div className="space-y-2">
                <Label
                  htmlFor="auth-email"
                  className="text-xs font-semibold text-fg-secondary"
                >
                  E-mail
                </Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-xl border-border-subtle bg-surface-2 px-3.5"
                  placeholder="seu@email.com"
                />
              </div>
            ) : null}

            {mode !== "forgot" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="auth-password"
                    className="text-xs font-semibold text-fg-secondary"
                  >
                    {mode === "recovery" ? "Nova senha" : "Senha"}
                  </Label>
                  {mode === "signup" || mode === "recovery" ? (
                    <span className="text-[10px] text-fg-muted">
                      Mínimo de 12 caracteres
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 6 : 12}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-xl border-border-subtle bg-surface-2 px-3.5 pr-11"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fg-muted hover:bg-surface-3"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "login" ? (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Esqueci minha senha
              </button>
            ) : mode === "forgot" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Voltar para o login
              </button>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl bg-brand font-semibold text-brand-fg shadow-[var(--shadow-brand)]"
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {loading
                ? "Processando..."
                : mode === "signup"
                  ? "Criar conta"
                  : mode === "forgot"
                    ? "Enviar link seguro"
                    : mode === "recovery"
                      ? "Atualizar senha"
                      : "Entrar"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
    }
  }, [open]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return toast.error("Supabase não conectado.");
    
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      
      // Tradução dos erros mais comuns do Supabase
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
      <DialogContent className="sm:max-w-[400px] bg-surface-1 border-border-strong text-fg-primary shadow-[var(--shadow-glass)]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isLogin ? "Acessar BrieFlow" : "Criar sua conta"}
          </DialogTitle>
          <DialogDescription className="text-fg-tertiary">
            {isLogin
              ? "Entre para salvar e gerenciar suas campanhas."
              : "Crie sua conta gratuitamente para salvar suas criações na biblioteca."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAuth} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-fg-secondary">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface-2 border-border-subtle focus-visible:ring-brand text-fg-primary"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-fg-secondary">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface-2 border-border-subtle focus-visible:ring-brand text-fg-primary"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]">
            {loading ? <Loader2 className="size-4 animate-spin" /> : (isLogin ? "Entrar" : "Criar conta")}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-fg-tertiary">
          {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-brand hover:underline font-medium">
            {isLogin ? "Cadastre-se" : "Faça login"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
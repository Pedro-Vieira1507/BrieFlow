// src/lib/stripe.ts
import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

// Instancie o Stripe com sua chave secreta do .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export const createCheckoutSessionFn = createServerFn({ method: "POST" })
  .validator((planId: "basic" | "pro" | "agency") => {
    if (!["basic", "pro", "agency"].includes(planId)) throw new Error("Plano inválido");
    return planId;
  })
  .handler(async ({ data: planId }) => {
    // 1. Verificar se o usuário está logado usando o Supabase[cite: 1]
    if (!supabase) throw new Error("Supabase não configurado.");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Você precisa estar logado para assinar.");

    // 2. Mapear o planId para o ID do Preço no Stripe (Price ID)
    const priceMap = {
      basic: process.env.STRIPE_PRICE_BASIC,
      pro: process.env.STRIPE_PRICE_PRO,
      agency: process.env.STRIPE_PRICE_AGENCY,
    };

    const priceId = priceMap[planId];
    if (!priceId) throw new Error("Price ID não configurado no servidor.");

    // 3. Criar a sessão de Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email, // Preenche o email automaticamente
      client_reference_id: user.id, // CRÍTICO: Vincula o pagamento ao usuário no Supabase
      line_items: [
        {
          price: priceId as string,
          quantity: 1,
        },
      ],
      success_url: `${process.env.VITE_APP_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VITE_APP_URL}/`,
    });

    return { checkoutUrl: session.url };
  });
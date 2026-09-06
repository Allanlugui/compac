import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrimeiroAcessoForm from "./PrimeiroAcessoForm";

export const metadata: Metadata = { title: "Primeiro acesso · SGA-M" };

/** Sem a flag, não há o que fazer aqui — segue para o dashboard. */
export default async function PrimeiroAcessoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.user_metadata?.must_change_password !== true) {
    redirect("/admin/dashboard");
  }
  return <PrimeiroAcessoForm />;
}

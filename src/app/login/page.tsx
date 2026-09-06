import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · SGA-M" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/admin/dashboard");

  return <LoginForm />;
}

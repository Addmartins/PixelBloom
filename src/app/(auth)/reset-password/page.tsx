import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/form";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password?link=invalid");
  return <AuthForm mode="reset" />;
}

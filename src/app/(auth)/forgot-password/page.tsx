import { AuthForm } from "@/features/auth/form";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  return <AuthForm mode="recovery" invalidLink={(await searchParams).link === "invalid"} />;
}

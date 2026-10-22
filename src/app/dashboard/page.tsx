import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <DashboardClient />;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return <DashboardClient userId={user.id} userEmail={user.email || ""} userName={userName} />;
}

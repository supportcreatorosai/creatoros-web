import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClientLayout } from "./dashboard-client-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Fetch user and profile
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/login");
  }

  // Fetch full_name from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single();

  const mergedUser = {
    ...user,
    full_name: profile?.full_name || "Creator",
    avatar_url: profile?.avatar_url
  };

  return (
    <DashboardClientLayout user={mergedUser}>
      {children}
    </DashboardClientLayout>
  );
}

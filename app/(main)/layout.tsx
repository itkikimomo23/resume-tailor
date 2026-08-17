import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, readEnv } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  const secret = readEnv(process.env.SESSION_SECRET);

  const session = token ? await verifySession(token, secret) : null;
  const role = (session?.role === "admin" ? "admin" : "assistant") as "admin" | "assistant";

  let userName = "";
  if (session?.userId) {
    const { data } = await supabase
      .from("team_users")
      .select("name")
      .eq("id", session.userId)
      .maybeSingle();
    userName = data?.name ?? "";
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar role={role} userName={userName} />
      <main className="flex-1 bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
}

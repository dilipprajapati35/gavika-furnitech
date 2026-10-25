"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && session?.access_token && isMounted) {
          const { data: adminUser } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (!isMounted) return;

          if (adminUser) {
            router.replace("/admin/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Admin redirect error:", err);
      }

      if (isMounted) {
        router.replace("/login");
      }
    }

    redirectAdmin();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center p-4">
      <div className="w-10 h-10 border-3 border-[#3d281c] border-t-transparent rounded-full animate-spin" />
    </main>
  );
}
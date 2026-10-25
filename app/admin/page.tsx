"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError("Email ya password incorrect hai.");
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      setError("Aapke account ko admin access nahi mila hai.");
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#e7dccd]">
          <div className="text-center mb-8">
            <img
              src="/logo.jpg"
              alt="Gavika Furnitech"
              className="h-20 w-20 object-contain mx-auto mb-4"
            />

            <h1 className="text-3xl font-serif font-semibold text-[#3d281c]">
              Admin Login
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              Gavika Furnitech
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#3d281c] mb-2">
                Admin Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter admin email"
                required
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3d281c] mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235]"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#5a3927] text-white py-3 font-medium hover:bg-[#432a1e] transition disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login to Admin Panel"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Secure Admin Area
          </p>
        </div>
      </div>
    </main>
  );
}
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isStrongPassword(value: string) {
    return (
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9]/.test(value)
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (isForgotPassword) {
      setLoading(true);

      try {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

        if (resetError) {
          setError(
            "We could not process your request. Please try again."
          );
          return;
        }

        setMessage(
          "If an account exists with this email, a password reset link has been sent."
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    if (isSignup) {
      const cleanName = name.trim();

      if (cleanName.length < 2) {
        setError("Please enter your full name.");
        return;
      }

      if (!isStrongPassword(password)) {
        setError(
          "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

        if (signupError) {
          const errorText = signupError.message.toLowerCase();

          if (
            errorText.includes("already registered") ||
            errorText.includes("already exists")
          ) {
            setError(
              "This email is already registered. Please log in instead."
            );
          } else {
            setError(
              "We could not create your account. Please try again."
            );
          }

          return;
        }

        clearForm();

        if (data.session) {
          router.push("/account");
          return;
        }

        setMessage(
          "Your account has been created. Please check your email to verify your account before logging in."
        );
      } else {
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) {
          setError(
            "Unable to log in. Please check your email and password."
          );
          return;
        }

        if (!data.user) {
          setError("Login failed. Please try again.");
          return;
        }

        router.push("/account");
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const { error: resendError } =
        await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
        });

      if (resendError) {
        setError(
          "We could not resend the verification email. Please try again."
        );
        return;
      }

      setMessage("A new verification email has been sent.");
    } finally {
      setResending(false);
    }
  }

  function switchMode() {
    clearForm();
    setIsSignup(!isSignup);
    setIsForgotPassword(false);
  }

  function openForgotPassword() {
    clearForm();
    setIsForgotPassword(true);
    setIsSignup(false);
  }

  function backToLogin() {
    clearForm();
    setIsForgotPassword(false);
    setIsSignup(false);
  }

  return (
    <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-xl border border-[#e7dccd] p-8">

          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo.jpg"
              alt="Gavika Furnitech"
              className="h-20 w-20 object-contain mx-auto mb-4"
            />

            <h1 className="text-3xl font-serif font-semibold text-[#3d281c]">
              {isForgotPassword
                ? "Reset Password"
                : isSignup
                ? "Create Account"
                : "Welcome Back"}
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              {isForgotPassword
                ? "Enter your email to receive a password reset link."
                : isSignup
                ? "Create your Gavika Furnitech account."
                : "Log in to view your orders and projects."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full Name */}
            {isSignup && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  autoFocus
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235]"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#3d281c] mb-2">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus={!isSignup}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235]"
              />
            </div>

            {/* Password */}
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete={
                      isSignup
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={8}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-20 outline-none focus:border-[#7a5235]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#7a5235]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {isSignup && (
                  <p className="text-xs text-gray-500 mt-2">
                    At least 8 characters with uppercase, lowercase,
                    number, and special character.
                  </p>
                )}
              </div>
            )}

            {/* Confirm Password */}
            {isSignup && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-20 outline-none focus:border-[#7a5235]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#7a5235]"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot Password */}
            {!isSignup && !isForgotPassword && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-sm text-[#7a5235] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {error}
              </div>
            )}

            {/* Success */}
            {message && (
              <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
                {message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#5a3927] text-white py-3 font-medium hover:bg-[#432a1e] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}

              {loading
                ? "Please wait..."
                : isForgotPassword
                ? "Send Reset Link"
                : isSignup
                ? "Create Account"
                : "Login"}
            </button>
          </form>

          {/* Resend Verification */}
          {isSignup && !isForgotPassword && (
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending}
              className="w-full mt-4 text-sm text-[#7a5235] hover:underline disabled:opacity-50"
            >
              {resending
                ? "Sending..."
                : "Resend Verification Email"}
            </button>
          )}

          {/* Bottom Navigation */}
          <div className="text-center mt-6">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={backToLogin}
                className="text-sm text-[#7a5235] font-medium hover:underline"
              >
                ← Back to Login
              </button>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  {isSignup
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </p>

                <button
                  type="button"
                  onClick={switchMode}
                  className="mt-2 text-[#7a5235] font-medium hover:underline"
                >
                  {isSignup
                    ? "Login here"
                    : "Create a new account"}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
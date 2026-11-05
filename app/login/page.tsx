"use client";

import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const reasonParam = searchParams.get("reason");
  const productNameParam = searchParams.get("productName");
  const loggedOutParam = searchParams.get("logged_out");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getSafeRedirect = (url: string | null) => {
    if (url && url.startsWith("/") && !url.startsWith("//")) {
      return url;
    }
    return "/account";
  };

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
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Field-level inline errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [touched, setTouched] = useState<{
    name?: boolean;
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});

  useEffect(() => {
    let isMounted = true;
    async function checkExistingSession() {
      if (loggedOutParam === "true") {
        try {
          await supabase.auth.signOut();
        } catch {}
        if (isMounted) setCheckingAuth(false);
        return;
      }

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

          router.replace(getSafeRedirect(redirectParam));
          return;
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
      if (isMounted) {
        setCheckingAuth(false);
      }
    }

    checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, [router, loggedOutParam, redirectParam]);

  function clearForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
    setFieldErrors({});
    setTouched({});
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

  function validateAuthField(field: string, val: string): string {
    switch (field) {
      case "name": {
        const trimmed = val.trim();
        if (!trimmed) return "Full Name is required.";
        if (trimmed.length < 2) return "Full Name must be at least 2 characters.";
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
          return "Full Name should contain letters and spaces only.";
        }
        return "";
      }
      case "email": {
        const clean = val.trim().toLowerCase();
        if (!clean) return "Email address is required.";
        if (!isValidEmail(clean)) {
          return "Please enter a valid email address (e.g. name@domain.com).";
        }
        return "";
      }
      case "password": {
        if (!val) return "Password is required.";
        if (!isSignup) {
          if (val.length < 6) return "Password must be at least 6 characters.";
          return "";
        }
        if (val.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(val)) return "Include at least one uppercase letter (A-Z).";
        if (!/[a-z]/.test(val)) return "Include at least one lowercase letter (a-z).";
        if (!/\d/.test(val)) return "Include at least one number (0-9).";
        if (!/[^A-Za-z0-9]/.test(val)) return "Include at least one special character (!@#$%^&*).";
        return "";
      }
      case "confirmPassword": {
        if (!val) return "Please confirm your password.";
        if (val !== password) return "Passwords do not match.";
        return "";
      }
      default:
        return "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    // Field-level error validation
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    const emailErr = validateAuthField("email", cleanEmail);
    if (emailErr) errors.email = emailErr;

    if (!isForgotPassword) {
      const passErr = validateAuthField("password", password);
      if (passErr) errors.password = passErr;
    }

    if (isSignup) {
      const nameErr = validateAuthField("name", name);
      if (nameErr) errors.name = nameErr;

      const confirmErr = validateAuthField("confirmPassword", confirmPassword);
      if (confirmErr) errors.confirmPassword = confirmErr;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({
        name: true,
        email: true,
        password: true,
        confirmPassword: true,
      });
      return;
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
          router.push(getSafeRedirect(redirectParam));
          return;
        }

        setMessage(
          "Your account has been created. Please check your email to verify your account before logging in."
        );
      } else {
        const { data: loginData, error: loginError } =
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

        if (!loginData.user) {
          setError("Login failed. Please try again.");
          return;
        }

        // Check if the user is an admin
        const { data: adminUser } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", loginData.user.id)
          .maybeSingle();

        if (adminUser) {
          router.push("/admin/dashboard");
        } else {
          router.push(getSafeRedirect(redirectParam));
        }
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

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-[#3d281c] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5efe6] flex flex-col justify-between">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#e7dccd] bg-[#f8f5ef]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-90 transition">
            <img
              src="/Gavika-new-logo.png"
              alt="Gavika Furnitech"
              className="h-10 w-10 object-contain"
            />
            <div>
              <p className="text-xl font-serif font-semibold tracking-wide text-[#29251f]">
                Gavika Furnitech
              </p>
              <p className="text-[10px] tracking-[0.2em] text-[#8b6f47]">
                PREMIUM FURNITURE
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="/" className="hover:text-[#8b6f47] transition">
              Home
            </a>
            <a href="/furniture" className="hover:text-[#8b6f47] transition">
              Furniture
            </a>
            <a href="/custom-furniture" className="hover:text-[#8b6f47] transition">
              Custom Furniture
            </a>
            <a href="/#process" className="hover:text-[#8b6f47] transition">
              About
            </a>
            <a href="/#contact" className="hover:text-[#8b6f47] transition">
              Contact
            </a>
            <a
              href="/"
              className="rounded-full border border-[#cfc4b5] bg-white px-4 py-1.5 text-xs font-semibold text-[#29251f] hover:bg-[#29251f] hover:text-white transition shadow-2xs flex items-center gap-1.5"
            >
              <span>🏪</span>
              <span>View Storefront</span>
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg border border-[#ded5c8] px-3 py-1.5 text-base"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#ded5c8] bg-[#f8f5ef] px-6 py-4">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              <a href="/" className="hover:text-[#8b6f47]">Home</a>
              <a href="/furniture" className="hover:text-[#8b6f47]">Furniture</a>
              <a href="/custom-furniture" className="hover:text-[#8b6f47]">Custom Furniture</a>
              <a href="/#process" className="hover:text-[#8b6f47]">About</a>
              <a href="/#contact" className="hover:text-[#8b6f47]">Contact</a>
            </nav>
          </div>
        )}
      </header>

      {/* Main Form Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          <div className="bg-white rounded-2xl shadow-xl border border-[#e7dccd] p-8">

            {/* Logo & Heading */}
            <div className="text-center mb-6">
              <img
                src="/Gavika-new-logo.png"
                alt="Gavika Furnitech"
                className="h-16 w-16 object-contain mx-auto mb-3"
              />

              <h1 className="text-3xl font-serif font-semibold text-[#3d281c]">
                {isForgotPassword
                  ? "Reset Password"
                  : isSignup
                    ? "Create Account"
                    : "Welcome Back"}
              </h1>

              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {isForgotPassword
                  ? "Enter your email to receive a password reset link."
                  : isSignup
                    ? "Create your Gavika Furnitech customer account."
                    : "Sign in to access your account. Administrators are automatically redirected to the Admin Dashboard."}
              </p>
            </div>

            {/* Logged Out Notice */}
            {loggedOutParam === "true" && (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-left shadow-2xs">
                <div className="flex items-start gap-3">
                  <span className="text-xl">👋</span>
                  <div className="text-xs">
                    <p className="font-semibold text-emerald-900 text-sm">
                      Signed Out Successfully
                    </p>
                    <p className="text-emerald-700 mt-0.5 leading-relaxed">
                      You have been safely logged out. You can sign in again below, or{" "}
                      <a href="/" className="font-semibold underline hover:text-emerald-900">
                        return to the store
                      </a>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Role Access Indicator */}
            {!isSignup && !isForgotPassword && !loggedOutParam && !reasonParam && (
              <div className="mb-6 p-3 rounded-xl bg-[#faf7f2] border border-[#e7dccd] text-xs text-[#7a5235] flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span>👑</span>
                  <span>Customer & Admin Portal</span>
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  Admins auto-open Dashboard
                </span>
              </div>
            )}

            {/* Checkout Login Intent Banner */}
            {reasonParam === "buy" && (
              <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-left shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-stone-900 text-sm">
                      Account Required to Complete Order
                    </p>
                    <p className="text-stone-600 mt-1 leading-relaxed">
                      {productNameParam ? (
                        <>
                          Please sign in or create an account to purchase{" "}
                          <strong className="text-stone-900">{productNameParam}</strong>.
                        </>
                      ) : (
                        "Please sign in or create an account to proceed with your order."
                      )}{" "}
                      Your order and delivery milestones will be linked to your account for live tracking.
                    </p>
                  </div>
                </div>
              </div>
            )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Full Name */}
            {isSignup && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (touched.name) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        name: validateAuthField("name", val),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      name: validateAuthField("name", name),
                    }));
                  }}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  autoFocus
                  className={`w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none transition ${
                    touched.name && fieldErrors.name
                      ? "border-red-500 focus:border-red-500 bg-red-50/20"
                      : "border-gray-300 focus:border-[#7a5235]"
                  }`}
                />
                {touched.name && fieldErrors.name && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.name}</span>
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#3d281c] mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  if (touched.email) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      email: validateAuthField("email", val),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, email: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    email: validateAuthField("email", email),
                  }));
                }}
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus={!isSignup}
                className={`w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none transition ${
                  touched.email && fieldErrors.email
                    ? "border-red-500 focus:border-red-500 bg-red-50/20"
                    : "border-gray-300 focus:border-[#7a5235]"
                }`}
              />
              {touched.email && fieldErrors.email && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                  <span>⚠️</span>
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            {/* Password */}
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Password <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassword(val);
                      if (touched.password) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: validateAuthField("password", val),
                        }));
                      }
                      if (touched.confirmPassword && confirmPassword) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword:
                            val !== confirmPassword
                              ? "Passwords do not match."
                              : "",
                        }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, password: true }));
                      setFieldErrors((prev) => ({
                        ...prev,
                        password: validateAuthField("password", password),
                      }));
                    }}
                    placeholder={
                      isSignup
                        ? "Create a strong password"
                        : "Enter your password"
                    }
                    autoComplete={
                      isSignup ? "new-password" : "current-password"
                    }
                    className={`w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 pr-12 outline-none transition ${
                      touched.password && fieldErrors.password
                        ? "border-red-500 focus:border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#7a5235]"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-[#7a5235] transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {touched.password && fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.password}</span>
                  </p>
                )}

                {/* Password strength checklist for Signup */}
                {isSignup && (
                  <div className="mt-2.5 p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1.5">
                    <p className="font-semibold text-stone-700">
                      Password Requirements:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                      <span className={password.length >= 8 ? "text-emerald-700 font-medium" : "text-gray-400"}>
                        {password.length >= 8 ? "✓" : "○"} At least 8 characters
                      </span>
                      <span className={/[A-Z]/.test(password) ? "text-emerald-700 font-medium" : "text-gray-400"}>
                        {/[A-Z]/.test(password) ? "✓" : "○"} Uppercase letter (A-Z)
                      </span>
                      <span className={/[a-z]/.test(password) ? "text-emerald-700 font-medium" : "text-gray-400"}>
                        {/[a-z]/.test(password) ? "✓" : "○"} Lowercase letter (a-z)
                      </span>
                      <span className={/\d/.test(password) ? "text-emerald-700 font-medium" : "text-gray-400"}>
                        {/\d/.test(password) ? "✓" : "○"} Number (0-9)
                      </span>
                      <span className={/[^A-Za-z0-9]/.test(password) ? "text-emerald-700 font-medium sm:col-span-2" : "text-gray-400 sm:col-span-2"}>
                        {/[^A-Za-z0-9]/.test(password) ? "✓" : "○"} Special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password */}
            {isSignup && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[#3d281c] mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfirmPassword(val);
                      if (touched.confirmPassword) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword: validateAuthField("confirmPassword", val),
                        }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, confirmPassword: true }));
                      setFieldErrors((prev) => ({
                        ...prev,
                        confirmPassword: validateAuthField(
                          "confirmPassword",
                          confirmPassword
                        ),
                      }));
                    }}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 pr-12 outline-none transition ${
                      touched.confirmPassword && fieldErrors.confirmPassword
                        ? "border-red-500 focus:border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#7a5235]"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-[#7a5235] transition"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.confirmPassword}</span>
                  </p>
                )}
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

          {/* Bottom Homepage / Store Navigation */}
          <div className="mt-6 pt-5 border-t border-stone-200 text-center space-y-2">
            {redirectParam ? (
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <a
                  href={redirectParam}
                  className="text-[#7a5235] hover:underline inline-flex items-center gap-1"
                >
                  <span>←</span>
                  <span>Return to your selected furniture</span>
                </a>
                <span className="text-stone-300">•</span>
                <a
                  href="/"
                  className="text-stone-500 hover:text-stone-800 transition"
                >
                  Home
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <a
                  href="/"
                  className="text-[#7a5235] hover:underline inline-flex items-center gap-1"
                >
                  <span>←</span>
                  <span>Return to Homepage</span>
                </a>
                <span className="text-stone-300">•</span>
                <a
                  href="/furniture"
                  className="text-stone-500 hover:text-stone-800 transition"
                >
                  Browse Furniture
                </a>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>

    {/* Footer */}
    <footer className="border-t border-[#e7dccd] py-6 text-center text-xs text-gray-500 bg-[#f8f5ef]">
      <p>© {new Date().getFullYear()} Gavika Furnitech. All rights reserved.</p>
    </footer>
  </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center p-4">
          <div className="w-10 h-10 border-3 border-[#3d281c] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
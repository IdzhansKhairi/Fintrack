"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          throw error;
        }
      } else {
        const trimmedName = fullName.trim();
        const trimmedPreferred =
          preferredName.trim() || trimmedName.split(/\s+/)[0] || trimmedName;

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              preferred_name: trimmedPreferred,
            },
          },
        });

        if (error) {
          throw error;
        }

        // Ensure profile is saved in public.profiles
        if (data.user) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              email: trimmedEmail,
              full_name: trimmedName,
              preferred_name: trimmedPreferred,
            },
            { onConflict: "id" }
          );
        }
      }

      // Redirect into /dashboard after sign in or registration
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(
        err.message || "An error occurred during authentication. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid p-0 min-vh-100 d-flex flex-column flex-lg-row">
      {/* ===========================
          LEFT SECTION (Hero / Branding)
          =========================== */}
      <div
        className="col-12 col-lg-6 d-flex flex-column justify-content-between text-white p-4 p-md-5 position-relative"
        style={{
          background:
            "linear-gradient(135deg, #184275 0%, #1c5689 35%, #2a6f7b 70%, #4ea277 100%)",
          minHeight: "450px",
        }}
      >
        {/* Top Logo */}
        <div className="d-flex align-items-center gap-2">
          <Image
            src="/images/fintrack-logo.png"
            alt="Fintrack Logo"
            width={38}
            height={38}
            className="rounded-3 shadow-sm"
          />
          <span className="fs-5 fw-bold text-white tracking-wide">Fintrack</span>
        </div>

        {/* Middle Headlines & Features */}
        <div className="my-5 my-lg-auto" style={{ maxWidth: "520px" }}>
          <h1
            className="text-white fw-bold mb-4"
            style={{
              fontSize: "2.4rem",
              lineHeight: 1.25,
              letterSpacing: "-0.5px",
            }}
          >
            Every RM, every goal — <br />
            in one calm dashboard.
          </h1>

          <div className="d-flex flex-column gap-3 mt-4">
            {/* Feature 1 */}
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <i className="bi bi-graph-up" style={{ fontSize: "1rem" }} />
              </div>
              <span className="text-white-50" style={{ fontSize: "0.95rem" }}>
                Track incomes, expenses and net worth in real time
              </span>
            </div>

            {/* Feature 2 */}
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <i className="bi bi-clock-history" style={{ fontSize: "1rem" }} />
              </div>
              <span className="text-white-50" style={{ fontSize: "0.95rem" }}>
                Understand where your money actually goes
              </span>
            </div>

            {/* Feature 3 */}
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <i className="bi bi-shield-check" style={{ fontSize: "1rem" }} />
              </div>
              <span className="text-white-50" style={{ fontSize: "0.95rem" }}>
                Private & secure. Your financial data stays yours.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-white-50 small" style={{ fontSize: "0.8rem" }}>
          © 2026 Fintrack. Personal finance, done right.
        </div>
      </div>

      {/* ===========================
          RIGHT SECTION (Card Form)
          =========================== */}
      <div
        className="col-12 col-lg-6 d-flex align-items-center justify-content-center p-4 p-md-5"
        style={{ backgroundColor: "#f9fbf5" }}
      >
        <div
          className="bg-white rounded-4 shadow-sm p-4 p-sm-5 w-100"
          style={{
            maxWidth: "430px",
            border: "1px solid rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Form Header */}
          <h2
            className="fw-bold mb-1"
            style={{ fontSize: "1.65rem", color: "#1a2e23" }}
          >
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-secondary small mb-4">
            {mode === "signin"
              ? "Sign in to your financial dashboard."
              : "Start tracking your personal finances."}
          </p>

          {/* Sign in / Register Switcher Pill */}
          <div
            className="d-flex p-1 rounded-pill mb-4"
            style={{ backgroundColor: "#eef3ed" }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
              }}
              className="btn btn-sm rounded-pill flex-grow-1 border-0 transition-all"
              style={{
                backgroundColor: mode === "signin" ? "#ffffff" : "transparent",
                color: mode === "signin" ? "#1a2e23" : "#6b7f72",
                fontWeight: mode === "signin" ? 600 : 500,
                fontSize: "0.85rem",
                padding: "8px 0",
                boxShadow:
                  mode === "signin" ? "0 2px 4px rgba(0, 0, 0, 0.06)" : "none",
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMessage(null);
              }}
              className="btn btn-sm rounded-pill flex-grow-1 border-0 transition-all"
              style={{
                backgroundColor: mode === "register" ? "#ffffff" : "transparent",
                color: mode === "register" ? "#1a2e23" : "#6b7f72",
                fontWeight: mode === "register" ? 600 : 500,
                fontSize: "0.85rem",
                padding: "8px 0",
                boxShadow:
                  mode === "register" ? "0 2px 4px rgba(0, 0, 0, 0.06)" : "none",
              }}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {/* Full Name & Preferred Name fields (Register only) */}
            {mode === "register" && (
              <>
                <div>
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmad Zulkifli"
                    className="form-control"
                    style={{
                      borderRadius: "10px",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderColor: "#dbe3dc",
                    }}
                  />
                </div>

                <div>
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Preferred name
                  </label>
                  <input
                    type="text"
                    required
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="Zul"
                    className="form-control"
                    style={{
                      borderRadius: "10px",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderColor: "#dbe3dc",
                    }}
                  />
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  mode === "signin" ? "ahmad@fintrack.my" : "ahmad@gmail.com"
                }
                className="form-control"
                style={{
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "0.9rem",
                  borderColor: "#dbe3dc",
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-control"
                style={{
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "0.9rem",
                  borderColor: "#dbe3dc",
                }}
              />
            </div>

            {errorMessage && (
              <div className="alert alert-danger py-2 small mb-0" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn text-white w-100 fw-medium mt-2"
              style={{
                backgroundColor: "#69a980",
                borderRadius: "10px",
                padding: "11px 0",
                fontSize: "0.95rem",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
              }}
            >
              {loading
                ? "Processing..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


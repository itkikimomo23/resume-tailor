"use client";

import { useState } from "react";
import { login } from "./actions";
import { FileText } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const result = await login(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl ring-1 ring-foreground/10 p-8 w-full max-w-sm shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <FileText size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">AI Resume Tailor</h1>
            <p className="text-xs text-muted-foreground">Sign in to your workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="field-input"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="field-input"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

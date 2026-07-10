"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { btnPrimary, input, label } from "@/lib/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@palestra.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore di accesso");
      return;
    }

    router.push(params.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto mt-20 max-w-sm px-4">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mb-4 text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        &larr; Torna alla prenotazione
      </button>
      <h1 className="mb-6 text-xl font-bold text-neutral-900 dark:text-white">
        Accesso staff <span className="text-yellow-400">.</span>
      </h1>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={label}>Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </label>
        <button type="submit" disabled={loading} className={`w-full ${btnPrimary}`}>
          {loading ? "Accesso in corso..." : "Accedi"}
        </button>
      </form>
      <p className="mt-4 text-xs text-neutral-500">Credenziali seed: admin@palestra.local / admin123</p>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

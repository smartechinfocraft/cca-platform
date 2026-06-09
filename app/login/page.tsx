"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsLoading(false);

    if (result?.ok && result.url) {
      window.location.href = result.url;
      return;
    }

    setError("Unable to sign in. Please check your credentials and database connection.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow"
      >
        <h1 className="mb-6 text-3xl font-bold">
          Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="mb-4 w-full rounded border p-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-4 w-full rounded border p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          disabled={isLoading}
          className="w-full rounded bg-black p-3 text-white"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}

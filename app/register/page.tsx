"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    alert("Account created");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow"
      >
        <h1 className="mb-6 text-3xl font-bold">
          Create Account
        </h1>

        <input
          placeholder="First Name"
          className="mb-4 w-full rounded border p-3"
          onChange={(e) =>
            setForm({
              ...form,
              firstName: e.target.value,
            })
          }
        />

        <input
          placeholder="Last Name"
          className="mb-4 w-full rounded border p-3"
          onChange={(e) =>
            setForm({
              ...form,
              lastName: e.target.value,
            })
          }
        />

        <input
          type="email"
          placeholder="Email"
          className="mb-4 w-full rounded border p-3"
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-6 w-full rounded border p-3"
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value,
            })
          }
        />

        <button
          className="w-full rounded bg-black p-3 text-white"
        >
          Register
        </button>
      </form>
    </main>
  );
}
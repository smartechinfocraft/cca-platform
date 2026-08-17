import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMessage("The verification link is incomplete.");
      return;
    }
    api.post("/public/auth/verify-email", { token })
      .then(response => {
        setState("success");
        setMessage(response.data.message || "Email verified. You can now sign in.");
      })
      .catch(error => {
        setState("error");
        setMessage(error.response?.data?.message || "This verification link is invalid or expired.");
      });
  }, [params]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--pitch)" }}>
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="text-4xl">{state === "loading" ? "⏳" : state === "success" ? "✅" : "⚠️"}</div>
        <h1 className="mt-4 text-2xl font-bold text-[var(--outfield)]">
          {state === "success" ? "Email verified" : state === "error" ? "Verification unsuccessful" : "Verifying email"}
        </h1>
        <p className="mt-3 text-slate-600">{message}</p>
        {state !== "loading" && (
          <Link to="/login" className="mt-6 inline-block rounded-full px-6 py-3 font-semibold" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
            Go to Parent Login
          </Link>
        )}
      </section>
    </main>
  );
}

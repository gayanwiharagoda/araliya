"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        void signIn("password", {
          email: data.get("email") as string,
          password: data.get("password") as string,
          flow,
        }).catch(() => setError("Could not authenticate. Check your details."));
      }}
    >
      <h1>{flow === "signIn" ? "Sign in" : "Sign up"}</h1>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" required />
      </label>
      <button type="submit">{flow === "signIn" ? "Sign in" : "Sign up"}</button>
      <button
        type="button"
        onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
      >
        {flow === "signIn"
          ? "Need an account? Sign up"
          : "Have an account? Sign in"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

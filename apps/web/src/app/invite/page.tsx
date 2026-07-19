"use client";

import { useSearchParams } from "next/navigation";

export default function InviteFallbackPage() {
  const token = useSearchParams().get("token");
  const appUrl = token ? `domusos://invite?token=${token}` : "domusos://invite";

  return (
    <main>
      <h1>Open DomusOS</h1>
      <p>Open this invite in the DomusOS app to join your building.</p>
      <a href={appUrl}>Open the app</a>
    </main>
  );
}

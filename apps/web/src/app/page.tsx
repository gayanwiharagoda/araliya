"use client";

import { useQuery } from "convex/react";
import { api } from "@domus/backend/convex/_generated/api";

export default function Home() {
  const tasks = useQuery(api.tasks.list);

  return (
    <main>
      <h1>DomusOS</h1>
      <pre>{JSON.stringify(tasks, null, 2)}</pre>
    </main>
  );
}

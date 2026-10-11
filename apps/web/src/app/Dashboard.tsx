"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@domus/backend/convex/_generated/api";
import type { Id } from "@domus/backend/convex/_generated/dataModel";
import { useState } from "react";

export function Dashboard() {
  const { signOut } = useAuthActions();
  const buildings = useQuery(api.buildings.listMine);
  const createBuilding = useMutation(api.buildings.create);
  const [selected, setSelected] = useState<Id<"buildings"> | null>(null);

  return (
    <main>
      <header>
        <h1>DomusOS</h1>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>

      <section>
        <h2>Your buildings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void createBuilding({ name: data.get("name") as string });
            e.currentTarget.reset();
          }}
        >
          <input name="name" placeholder="Building name" required />
          <button type="submit">Create building</button>
        </form>
        <ul>
          {buildings?.map((b) => (
            <li key={b._id}>
              <button onClick={() => setSelected(b._id)}>{b.name}</button>
            </li>
          ))}
        </ul>
      </section>

      {selected && <BuildingDetail buildingId={selected} />}
    </main>
  );
}

function BuildingDetail({ buildingId }: { buildingId: Id<"buildings"> }) {
  const units = useQuery(api.units.list, { buildingId });
  const members = useQuery(api.members.list, { buildingId });
  const addUnit = useMutation(api.units.add);

  return (
    <section>
      <h2>Units</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void addUnit({ buildingId, label: data.get("label") as string });
          e.currentTarget.reset();
        }}
      >
        <input name="label" placeholder="Unit label (e.g. A-12)" required />
        <button type="submit">Add unit</button>
      </form>
      <ul>
        {units?.map((u) => (
          <li key={u._id}>{u.label}</li>
        ))}
      </ul>

      <h2>Members</h2>
      <ul>
        {members?.map((m) => (
          <li key={m._id}>{m.role}</li>
        ))}
      </ul>
    </section>
  );
}

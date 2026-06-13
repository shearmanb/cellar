"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COLUMNS, COLUMN_COOKIE } from "@/lib/columns";

// Persists the bottle-list column selection from the Control Panel into a
// year-long cookie the bottles page reads server-side. Not httpOnly — it's a
// pure display preference, no security weight.
export async function saveColumns(form: FormData) {
  const selected = COLUMNS.map((c) => c.key).filter((k) => form.get(`col_${k}`) === "on");
  const store = await cookies();
  store.set(COLUMN_COOKIE, selected.join(","), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/control-panel?saved=1");
}

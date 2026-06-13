import { BottleForm } from "@/components/bottle-form";
import { createBottle } from "@/lib/actions/bottles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewBottlePage() {
  const rules = await prisma.brandRule.findMany({
    select: { brandKey: true, distillery: true, category: true, ndp: true },
  });
  return (
    <>
      <h1>New bottle</h1>
      <BottleForm action={createBottle} submitLabel="Create bottle" rules={rules} />
    </>
  );
}

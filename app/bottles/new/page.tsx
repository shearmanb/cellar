import { BottleForm } from "@/components/bottle-form";
import { createBottle } from "@/lib/actions/bottles";

export default function NewBottlePage() {
  return (
    <>
      <h1>New bottle</h1>
      <BottleForm action={createBottle} submitLabel="Create bottle" />
    </>
  );
}

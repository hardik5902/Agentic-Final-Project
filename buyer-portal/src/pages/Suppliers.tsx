import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import PortalShell from "../components/PortalShell";
import SupplierTable from "../components/SupplierTable";
import { useCreateSupplier, useSuppliers } from "../hooks/useSuppliers";

const CATEGORIES = [
  { id: "professional_services", label: "Professional Services" },
  { id: "saas_tools", label: "SaaS Tools" },
  { id: "marketing_agencies", label: "Marketing Agencies" },
];

const supplierSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  website: z.string().url().optional().or(z.literal("")),
  country: z.string().min(2).max(2).optional().or(z.literal("")),
  notes: z.string().optional(),
});

type SupplierValues = z.infer<typeof supplierSchema>;

export default function Suppliers() {
  const { data, isLoading, error } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
  });

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setCategoryError("");
  };

  const onSubmit = async (values: SupplierValues) => {
    if (!selectedCategories.length) {
      setCategoryError("Select at least one category.");
      return;
    }
    await createSupplier.mutateAsync({
      ...values,
      categories: selectedCategories,
      website: values.website || undefined,
      country: values.country || undefined,
    });
    reset();
    setSelectedCategories([]);
  };

  return (
    <PortalShell
      title="Supplier directory"
      eyebrow="Maintain your preferred suppliers, monitor response patterns, and keep new invitation lists ready to go."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <section>
          {isLoading ? (
            <div className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
          ) : error ? (
            <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
              Unable to load suppliers.
            </div>
          ) : (
            <SupplierTable suppliers={data?.items ?? []} />
          )}
        </section>
        <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
            Add supplier
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Create a supplier contact</h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="block text-sm text-slate-200">
              Name
              <input
                {...register("name")}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
              />
              <span className="mt-1 block text-xs text-rose-200">{errors.name?.message}</span>
            </label>
            <label className="block text-sm text-slate-200">
              Email
              <input
                {...register("email")}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
              />
              <span className="mt-1 block text-xs text-rose-200">{errors.email?.message}</span>
            </label>
            <label className="block text-sm text-slate-200">
              Website
              <input
                {...register("website")}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
              />
            </label>
            <label className="block text-sm text-slate-200">
              Country
              <input
                {...register("country")}
                placeholder="US"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
              />
            </label>
            <div className="block text-sm text-slate-200">
              Categories
              <div className="mt-2 space-y-2">
                {CATEGORIES.map((cat) => (
                  <label key={cat.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 hover:border-cyan-300/40">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="h-4 w-4 rounded accent-cyan-400"
                    />
                    <span className="text-white">{cat.label}</span>
                  </label>
                ))}
              </div>
              {categoryError && (
                <span className="mt-1 block text-xs text-rose-200">{categoryError}</span>
              )}
            </div>
            <label className="block text-sm text-slate-200">
              Notes
              <textarea
                {...register("notes")}
                className="mt-2 min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || createSupplier.isPending}
              className="w-full rounded-full bg-amber-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
            >
              Add supplier
            </button>
          </form>
        </section>
      </div>
    </PortalShell>
  );
}

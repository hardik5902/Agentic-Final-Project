import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import api from "../lib/api";
import { setToken } from "../lib/auth";
import { AuthResponse } from "../types";

const registerSchema = z.object({
  name: z.string().min(2),
  org_name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterValues) => {
    try {
      const { data } = await api.post<AuthResponse>("/api/auth/register", values);
      setToken(data.access_token);
      navigate("/dashboard");
    } catch {
      setError("root", {
        message: "Registration failed. The email may already be in use.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">QuoteFlow</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Create buyer workspace</h1>
        <form className="mt-8 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="text-sm text-slate-200">
            Your name
            <input
              {...register("name")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
            />
            <span className="mt-1 block text-xs text-rose-200">{errors.name?.message}</span>
          </label>
          <label className="text-sm text-slate-200">
            Organization
            <input
              {...register("org_name")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
            />
            <span className="mt-1 block text-xs text-rose-200">
              {errors.org_name?.message}
            </span>
          </label>
          <label className="text-sm text-slate-200">
            Email
            <input
              {...register("email")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
            />
            <span className="mt-1 block text-xs text-rose-200">{errors.email?.message}</span>
          </label>
          <label className="text-sm text-slate-200">
            Password
            <input
              type="password"
              {...register("password")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
            />
            <span className="mt-1 block text-xs text-rose-200">
              {errors.password?.message}
            </span>
          </label>
          <span className="text-sm text-rose-200">{errors.root?.message}</span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-full bg-amber-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-300">
          Already registered?{" "}
          <Link className="text-cyan-200" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import api from "../lib/api";
import { setToken } from "../lib/auth";
import { AuthResponse } from "../types";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    try {
      const payload = new URLSearchParams();
      payload.set("username", values.email);
      payload.set("password", values.password);

      const { data } = await api.post<AuthResponse>("/api/auth/login", payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      setToken(data.access_token);
      navigate("/dashboard");
    } catch {
      setError("root", { message: "Unable to sign in. Check your email and password." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">QuoteFlow</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Buyer sign in</h1>
        <p className="mt-2 text-sm text-slate-300">
          Manage RFQs, monitor supplier responses, and generate decision memos.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm text-slate-200">
            Email
            <input
              {...register("email")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-cyan-300/70"
            />
            <span className="mt-1 block text-xs text-rose-200">{errors.email?.message}</span>
          </label>
          <label className="block text-sm text-slate-200">
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
          <span className="block text-sm text-rose-200">{errors.root?.message}</span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-amber-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-300">
          Need an account?{" "}
          <Link className="text-cyan-200" to="/register">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

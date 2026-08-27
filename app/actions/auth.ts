"use server";

import { redirect } from "next/navigation";
import { registerUser, loginUser } from "@/lib/auth-service";
import { createSession, deleteSession } from "@/lib/session";

export type AuthFormState = { error: string } | undefined;

export async function register(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = await registerUser({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await createSession(result.userId);
  redirect("/bookings");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = await loginUser({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await createSession(result.userId);
  redirect("/bookings");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

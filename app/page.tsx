import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";

export default async function Home() {
  const session = await getSessionPayload();
  redirect(session?.userId ? "/bookings" : "/login");
}

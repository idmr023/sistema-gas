import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";

export const instant = false;

export default async function Inicio() {
  const sesion = await getSesion();
  redirect(sesion ? "/dashboard" : "/login");
}

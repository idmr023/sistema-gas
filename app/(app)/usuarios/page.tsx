import Link from "next/link";
import { Suspense } from "react";
import { exigirPermiso } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsuariosSection from "@/components/usuarios-section";

export const metadata = { title: "Usuarios" };

export default function UsuariosPage() {
  return (
    <Suspense fallback={null}>
      <UsuariosPageContent />
    </Suspense>
  );
}

async function UsuariosPageContent() {
  await exigirPermiso("usuarios");

  const [usuarios, roles] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        email: true,
        rolId: true,
        rol: { select: { nombre: true } },
        telefono: true,
        activo: true,
        twoFactorEnabled: true,
      },
    }),
    prisma.rol.findMany({
      where: { activo: true },
      orderBy: [{ esSistema: "desc" }, { nombre: "asc" }],
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Crea usuarios con su correo, asígnales un rol y restablece contraseñas.
        </p>
      </div>

      <UsuariosSection
        usuarios={usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          rolId: u.rolId,
          rolNombre: u.rol.nombre,
          telefono: u.telefono,
          activo: u.activo,
          twoFactorEnabled: u.twoFactorEnabled,
        }))}
        roles={roles}
      />

      <section className="card text-sm text-slate-600">
        <h2 className="card-title">Roles</h2>
        <p>
          Los roles y sus permisos se gestionan en{" "}
          <Link href="/roles" className="font-bold text-brand-600">
            Roles 🔐
          </Link>
          . Al crear un usuario, este deberá cambiar su contraseña en el primer inicio;
          si su rol requiere 2FA, también configurará Google Authenticator.
        </p>
      </section>
    </div>
  );
}

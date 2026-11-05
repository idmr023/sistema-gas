import { Suspense } from "react";
import { exigirPermiso } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RolesSection from "@/components/roles-section";

export const metadata = { title: "Roles" };

export default function RolesPage() {
  return (
    <Suspense fallback={null}>
      <RolesPageContent />
    </Suspense>
  );
}

async function RolesPageContent() {
  await exigirPermiso("roles");

  const roles = await prisma.rol.findMany({
    orderBy: [{ esSistema: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { usuarios: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold">Roles</h1>
        <p className="text-sm text-slate-500">
          Roles del sistema y sus permisos por módulo. Los cambios aplican de inmediato.
        </p>
      </div>

      <RolesSection
        roles={roles.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          requiere2fa: r.requiere2fa,
          puedeLogin: r.puedeLogin,
          activo: r.activo,
          esSistema: r.esSistema,
          permisos: Array.isArray(r.permisos) ? (r.permisos as string[]) : [],
          usuarios: r._count.usuarios,
        }))}
      />
    </div>
  );
}

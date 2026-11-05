"use client";

import { useActionState, useState } from "react";
import { eliminarRol, guardarRol, type ResultadoRol } from "@/lib/actions/roles";
import { MODULOS } from "@/lib/permisos";
import BotonEliminar from "@/components/boton-eliminar";

type Rol = {
  id: number;
  nombre: string;
  requiere2fa: boolean;
  puedeLogin: boolean;
  activo: boolean;
  esSistema: boolean;
  permisos: string[];
  usuarios: number;
};

const inicial: ResultadoRol = { ok: false };

function Aviso({ estado }: { estado: ResultadoRol }) {
  if (!estado.ok && !estado.error) return null;
  if (estado.error)
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
        {estado.error}
      </p>
    );
  return (
    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
      ✅ Guardado.
    </p>
  );
}

export default function RolesSection({ roles }: { roles: Rol[] }) {
  const [estado, submit, pendiente] = useActionState(guardarRol, inicial);
  const [editando, setEditando] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const rolEditando = editando ? roles.find((r) => r.id === editando) : null;
  const mostrandoForm = nuevo || rolEditando;

  return (
    <div className="flex flex-col gap-4">
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title">Roles registrados</h2>
          <button
            type="button"
            onClick={() => {
              setNuevo(true);
              setEditando(null);
            }}
            className="btn btn-primary btn-sm"
          >
            ➕ Nuevo rol
          </button>
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="table-base min-w-[640px]">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Permisos</th>
                <th>2FA</th>
                <th>Login</th>
                <th>Usuarios</th>
                <th>Estado</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className={r.activo ? "" : "opacity-50"}>
                  <td className="font-bold">
                    {r.nombre}
                    {r.esSistema && (
                      <span className="badge badge-slate ml-2 text-[10px]">sistema</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">
                    {r.permisos.length === 0
                      ? "—"
                      : `${r.permisos.length} módulo(s)`}
                  </td>
                  <td>{r.requiere2fa ? "✅" : "—"}</td>
                  <td>{r.puedeLogin ? "✅" : "🚫"}</td>
                  <td>{r.usuarios}</td>
                  <td>
                    {r.activo ? (
                      <span className="badge badge-emerald">Activo</span>
                    ) : (
                      <span className="badge badge-red">Inactivo</span>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(r.id);
                          setNuevo(false);
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        ✏️
                      </button>
                      {!r.esSistema && r.usuarios === 0 && (
                        <BotonEliminar
                          accion={() => eliminarRol(r.id)}
                          mensaje={`¿Eliminar el rol ${r.nombre}?`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {mostrandoForm && (
        <section className="card">
          <h2 className="card-title">
            {rolEditando ? `✏️ Editar: ${rolEditando.nombre}` : "➕ Nuevo rol"}
          </h2>
          <form action={submit} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={rolEditando?.id ?? ""} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="r-nombre">Nombre del rol</label>
                <input
                  id="r-nombre"
                  name="nombre"
                  className="input"
                  required
                  maxLength={40}
                  defaultValue={rolEditando?.nombre ?? ""}
                  placeholder="EJ: SUPERVISOR"
                  disabled={rolEditando?.esSistema}
                />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="requiere2fa"
                    value="1"
                    defaultChecked={rolEditando?.requiere2fa ?? false}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Requiere 2FA (Google Authenticator)
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="puedeLogin"
                    value="1"
                    defaultChecked={rolEditando?.puedeLogin ?? true}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Puede iniciar sesión
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="activo"
                    value="1"
                    defaultChecked={rolEditando?.activo ?? true}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Rol activo
                </label>
              </div>
            </div>

            <fieldset className="rounded-xl bg-slate-50 p-3">
              <legend className="px-1 text-sm font-bold text-slate-600">
                Permisos por módulo
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULOS.map((m) => (
                  <label
                    key={m.clave}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      name="permisos"
                      value={m.clave}
                      defaultChecked={rolEditando?.permisos.includes(m.clave) ?? false}
                      className="h-4 w-4 accent-brand-500"
                    />
                    <span>{m.icon}</span> {m.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Aviso estado={estado} />

            <div className="flex gap-2">
              <button type="submit" disabled={pendiente} className="btn btn-primary">
                {pendiente ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNuevo(false);
                  setEditando(null);
                }}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

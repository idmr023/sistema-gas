"use client";

import { useActionState, useState } from "react";
import {
  eliminarUsuario,
  guardarUsuario,
  type ResultadoUsuario,
} from "@/lib/actions/usuarios";
import BotonEliminar from "@/components/boton-eliminar";

type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rolId: number;
  rolNombre: string;
  telefono: string | null;
  activo: boolean;
  twoFactorEnabled: boolean;
};

type Rol = { id: number; nombre: string };

const inicial: ResultadoUsuario = { ok: false };

function Aviso({ estado }: { estado: ResultadoUsuario }) {
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

export default function UsuariosSection({
  usuarios,
  roles,
}: {
  usuarios: Usuario[];
  roles: Rol[];
}) {
  const [estado, submit, pendiente] = useActionState(guardarUsuario, inicial);
  const [editando, setEditando] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const usuarioEditando = editando ? usuarios.find((u) => u.id === editando) : null;
  const mostrandoForm = nuevo || usuarioEditando;

  return (
    <div className="flex flex-col gap-4">
      {/* Lista */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title">Usuarios registrados</h2>
          <button
            type="button"
            onClick={() => {
              setNuevo(true);
              setEditando(null);
            }}
            className="btn btn-primary btn-sm"
          >
            ➕ Nuevo usuario
          </button>
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>2FA</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.activo ? "" : "opacity-50"}>
                  <td className="font-bold">{u.nombre}</td>
                  <td className="text-slate-500">{u.email}</td>
                  <td>
                    <span className="badge badge-slate">{u.rolNombre}</span>
                  </td>
                  <td>{u.twoFactorEnabled ? "✅" : "—"}</td>
                  <td className="text-slate-500">{u.telefono || "—"}</td>
                  <td>
                    {u.activo ? (
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
                          setEditando(u.id);
                          setNuevo(false);
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        ✏️
                      </button>
                      {u.activo && (
                        <BotonEliminar
                          accion={() => eliminarUsuario(u.id)}
                          mensaje={`¿Desactivar al usuario ${u.nombre}?`}
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

      {/* Formulario */}
      {mostrandoForm && (
        <section className="card">
          <h2 className="card-title">
            {usuarioEditando
              ? `✏️ Editar: ${usuarioEditando.nombre}`
              : "➕ Nuevo usuario"}
          </h2>
          <form action={submit} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={usuarioEditando?.id ?? ""} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="u-nombre">Nombre</label>
                <input
                  id="u-nombre"
                  name="nombre"
                  className="input"
                  required
                  maxLength={60}
                  defaultValue={usuarioEditando?.nombre ?? ""}
                  placeholder="Nombre del usuario"
                />
              </div>
              <div>
                <label className="label" htmlFor="u-email">Correo</label>
                <input
                  id="u-email"
                  name="email"
                  type="email"
                  className="input"
                  required
                  maxLength={120}
                  defaultValue={usuarioEditando?.email ?? ""}
                  placeholder="usuario@ejemplo.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="u-rol">Rol</label>
                <select
                  id="u-rol"
                  name="rolId"
                  className="input"
                  defaultValue={usuarioEditando?.rolId ?? roles[0]?.id ?? ""}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="u-password">
                  {usuarioEditando ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
                </label>
                <input
                  id="u-password"
                  name="password"
                  type="password"
                  className="input"
                  required={!usuarioEditando}
                  minLength={8}
                  maxLength={128}
                  placeholder={
                    usuarioEditando
                      ? "Vacío = no cambiar · al guardar, se exigirá cambiarla al entrar"
                      : "Mínimo 8 caracteres"
                  }
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="u-telefono">Teléfono</label>
                <input
                  id="u-telefono"
                  name="telefono"
                  className="input"
                  maxLength={30}
                  defaultValue={usuarioEditando?.telefono ?? ""}
                  placeholder="999 888 777"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                name="activo"
                value="1"
                defaultChecked={usuarioEditando?.activo ?? true}
                className="h-4 w-4 accent-amber-500"
              />
              Usuario activo
            </label>

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

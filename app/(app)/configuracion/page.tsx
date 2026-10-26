import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import {
  NegocioForm,
  NotificacionesForm,
  ImapForm,
  PinForm,
  MarcasSection,
  RepartidoresSection,
} from "@/components/config-forms";
import RevisarCorreo from "@/components/revisar-correo";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  await exigirSesion();

  const [filas, marcas, reps] = await Promise.all([
    prisma.config.findMany(),
    prisma.marca.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] }),
    prisma.repartidor.findMany({ orderBy: { activo: "desc" } }),
  ]);

  const cfg: Record<string, string> = {};
  for (const f of filas) cfg[f.clave] = f.valor ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold">Configuración</h1>
        <p className="text-sm text-slate-500">Datos del negocio, avisos, acceso y catálogos.</p>
      </div>

      <section className="card">
        <h2 className="card-title">🏪 Datos del negocio</h2>
        <NegocioForm cfg={cfg} />
      </section>

      <section className="card">
        <h2 className="card-title">🟣 Pagos Yape y avisos</h2>
        <NotificacionesForm cfg={cfg} />
      </section>

      <section className="card">
        <h2 className="card-title">📧 Correo de Yape (IMAP)</h2>
        <p className="mb-3 text-xs text-slate-500">
          El sistema revisa el correo cada minuto: cuando llega un aviso de pago de Yape se
          registra el movimiento y suena la alerta. Requiere que el buzón reciba esos correos.
        </p>
        <ImapForm cfg={cfg} />
        <div className="mt-3 border-t border-slate-100 pt-3">
          <RevisarCorreo />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">🔒 Acceso (PIN)</h2>
        <PinForm />
      </section>

      <section className="card">
        <h2 className="card-title">🛢️ Marcas y precios</h2>
        <MarcasSection
          marcas={marcas.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            precioDefecto: m.precioDefecto as unknown as number,
            activo: m.activo,
          }))}
        />
      </section>

      <section className="card">
        <h2 className="card-title">🛵 Repartidores</h2>
        <RepartidoresSection
          reps={reps.map((r) => ({
            id: r.id,
            nombre: r.nombre,
            telefono: r.telefono,
            activo: r.activo,
          }))}
        />
      </section>
    </div>
  );
}

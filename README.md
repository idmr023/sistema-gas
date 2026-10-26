# Sistema de Gestión para Negocio de Gas

**Sistema integral para control de ventas, inventario diario y pagos (efectivo y Yape) de un negocio de distribución de gas en cilindros/balones.**

---

## 1. Alcance General

Este es un sistema **web todo en uno** (frontend + backend + base de datos) que permite administrar el negocio de gas completo:

- Registrar **ventas** de balones de gas con todos sus datos.
- Controlar el **inventario diario** por marca con conteo automático.
- Gestionar **clientes**, direcciones y teléfonos.
- Registrar **pagos** (efectivo, Yape, transferencia) y **saldos pendientes**.
- Controlar **balones prestados y devueltos**.
- Asignar repartidores a cada venta.
- Recibir **notificaciones en tiempo real** de nuevos pagos.
- Visualizar **reportes y estadísticas** del negocio.

El sistema funciona en **PC local (red del negocio)** y en **la nube**, y es instalable como aplicación en el celular (PWA).

---

## 2. Dashboard (Panel Principal)

Al iniciar sesión se accede al panel con una vista resumen del negocio:

### Tarjetas de resumen del día
| Métrica | Descripción |
|---|---|
| Ventas de hoy | Total de dinero vendido en el día |
| Balones vendidos | Cantidad de balones entregados |
| Cobrado / Saldo | Lo que ya se cobró vs lo que está a saldo |
| Balones prestados | Balones entregados sin cobrar ni devolver |
| Ventas pendientes | Clientes con saldo por pagar |

### Gráficas
- Ventas de los últimos 7 / 30 días.
- Venta por repartidor.
- Marca más vendida.

### Alertas
- Pagos Yape recibidos (notificación en pantalla + sonido + Telegram).
- Balones prestados hace más de X días sin devolver.
- Descuadres de inventario.

---

## 3. Módulos del Sistema

### 3.1 Ventas
Registro rápido de cada venta con los siguientes campos:

| Campo | Descripción |
|---|---|
| Fecha | Día de la venta |
| Cliente | Nombre del cliente (o venta a mostrador) |
| Dirección | Dirección de entrega |
| Teléfono | Número de contacto |
| Premium | Sí / No (gas premium o normal) |
| Marca | Lista de marcas disponibles (Solgas, Lima Gas, Repsol, Zeta, Primax, etc.) |
| Cantidad | Número de balones |
| Valor unitario | Precio del balón (sugerido por marca) |
| Total | Cantidad × valor unitario (cálculo automático) |
| A cuenta | Monto pagado de contado |
| Saldo | Total − a cuenta (cálculo automático) |
| Prestado | Sí / No (si el balón se prestó sin cobro) |
| Regresado | Sí / No (si el balón vacío ya fue devuelto) |
| Repartidor | Adolfo, David, Michael o Jose |
| Notas | Observaciones adicionales |

### 3.2 Clientes
- Registro de clientes con nombre, dirección y teléfono.
- Búsqueda rápida por nombre o teléfono.
- Historial de compras por cliente.
- Saldos pendientes por cliente.

### 3.3 Inventario Diario
Control de balones por día y por marca:

| Campo | Descripción |
|---|---|
| INICIO | Balones con los que se inicia el día |
| Marca | Marca del balón |
| COMPRADOS | Balones comprados en el día (adicional) |
| VACIOS | Balones vacíos al final del día |
| **VENTA DEL DÍA** | **= INICIO + COMPRADOS − VACIOS** (cálculo automático) |

El sistema cruza esta cifra con las ventas registradas para detectar **descuadres**.

### 3.4 Pagos y Cuentas
- Registro de pagos: efectivo, Yape o transferencia.
- Cada pago se asocia a una venta o queda como pago libre.
- Cálculo automático de saldo restante por venta y por cliente.
- Historial completo de movimientos.

### 3.5 Reportes
- **Caja del día**: ventas, cobrado y saldo.
- **Por repartidor**: cantidad entregada por cada persona.
- **Por marca**: qué marca se vende más.
- **Saldos pendientes**: clientes que deben.
- **Balones prestados**: pendientes de devolución.
- Exportación a Excel/CSV.

### 3.6 Notificaciones
- Aviso en pantalla (toast) cuando llega un pago Yape.
- Sonido de alerta configurable.
- Notificación a Telegram (opcional).
- Centro de notificaciones con historial.

---

## 4. Roles y Acceso

### 4.1 Nivel actual: PIN único
- Acceso con **un solo PIN** (por defecto `1234`, obligatorio cambiarlo en la primera entrada).
- Sesión guardada en el navegador (30 días).
- Ideal para un negocio familiar / un solo usuario administrativo.

### 4.2 Nivel futuro: Usuarios y roles (opcional)
Se puede ampliar a usuarios individuales con permisos:

| Rol | Permisos |
|---|---|
| **Administrador** | Todo: configuración, precios, usuarios, reportes, borrados. |
| **Operador** | Registrar ventas, clientes, pagos y capturar inventario. |
| **Repartidor** | Ver sus ventas asignadas y marcar entregas / devoluciones. |

> *La ampliación a roles queda contemplada en la arquitectura de la base de datos (campo `rol` en usuarios) para activarse cuando se requiera.*

---

## 5. Base de Datos (PostgreSQL)

Motor: **PostgreSQL en la nube (Neon)** — base `sistema_gas`, sin Docker. Migraciones y datos iniciales con Prisma.

```
marcas            →  id, nombre, precio_defecto, activo
repartidores      →  id, nombre, telefono, activo
clientes          →  id, nombre, direccion, telefono, notas
usuarios          →  id, nombre, rol (ADMIN/OPERADOR/REPARTIDOR), pin_hash, activo
ventas            →  id, fecha, cliente_id, direccion, telefono, premium,
                     marca_id, cantidad, valor_unitario, total,
                     a_cuenta, saldo, estado (PENDIENTE/PARCIAL/PAGADO),
                     prestado, regresado, repartidor_id, notas
pagos             →  id, fecha, venta_id, monto, metodo, estado (PENDIENTE/CONFIRMADO),
                     referencia, pagador, origen (manual/imap/webhook)
inventario_diario →  id, fecha, marca_id, inicio, comprados, vacios,
                     UNIQUE(fecha, marca_id)
notificaciones    →  id, tipo, titulo, mensaje, meta, leida
config            →  clave, valor  (datos del negocio, Yape, Telegram, IMAP)
emails_procesados →  id, message_id, asunto, remitente, monto, referencia,
                     pago_id  (dedupe de correos ya leídos)
```

**Datos sembrados al instalar:**
- Marcas: Solgas, Lima Gas, Repsol, Zeta Gas, Primax (editables).
- Repartidores: Adolfo, David, Michael, Jose (editables).
- Usuario administrador con PIN `1234` (cambiarlo en Configuración).

**Invariante de saldos:** `a_cuenta` = suma de pagos CONFIRMADO; `saldo = total − a_cuenta`;
el estado PENDIENTE/PARCIAL/PAGADO se recalcula en cada alta, baja o conciliación de pago.

---

## 6. Integración con Yape

Yape **no ofrece API pública** para cuentas personales. El sistema se conecta por **correo (IMAP)**:

1. Un **worker** (arranca con el servidor y corre cada 60 segundos) revisa el buzón.
2. Cuando detecta un correo de pago Yape, extrae **monto, pagador y código de operación** (ignora correos ya procesados).
3. Si **exactamente una venta abierta** coincide con ese saldo, el pago se aplica solo
   (**CONFIRMADO**) y se recalcula el saldo; si no, queda **PENDIENTE** en *Pagos*
   para asignarla a mano con el selector "Asignar a…".
4. Dispara la **notificación en pantalla + sonido + Telegram**.
5. En *Configuración → Correo Yape* hay un botón **"Revisar correo ahora"** para no esperar al minuto.

> **Nota:** Si el buzón no recibe los correos de Yape, el mismo adaptador permite conectar el reenvío desde el celular (MacroDroid / Tasker) o un webhook, sin rehacer el sistema.

---

## 7. Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, cacheComponents) + Tailwind CSS 4 + PWA instalable |
| Backend | Next.js Server Actions + Route Handlers (SSE y CSV) |
| Base de datos | PostgreSQL **Neon** (la nube) · Prisma 7 + migraciones |
| ORM | Prisma 7 (`prisma7.config.ts`, cliente generado en `app/generated/prisma`) |
| Autenticación | PIN (scrypt) + cookie `httpOnly` firmada con HMAC (30 días) |
| Notificaciones | SSE en vivo + sonido + Telegram (opcional) |
| Correo Yape | Worker IMAP (`imapflow` + `mailparser`) vía `instrumentation.ts` |
| Pruebas | `node scripts/e2e.mjs` (login, venta, saldo, CSV, conciliación Yape) |

---

## 8. Cómo ejecutar y despliegue

### Requisitos
- Node.js 22 o superior.
- Base de datos PostgreSQL (ya conectada: **Neon**, credenciales en `.env`).

### Instalación (PC local)
```bash
npm install
npm run db:migrate    # aplica el esquema
npm run db:seed       # marcas, repartidores y PIN admin
npm run dev           # abre http://localhost:3000
```

### Compilar para uso real
```bash
npm run build
npm start             # servidor optimizado en el puerto 3000
```

### Comandos útiles
| Comando | Para qué |
|---|---|
| `npm run typecheck` / `npm run lint` | Verificar tipos y estilo |
| `npm run db:migrate` / `npm run db:seed` | Migraciones y datos iniciales |
| `npm run db:studio` | Explorar la base de datos en el navegador |
| `npm run icons` | Regenerar los íconos de la PWA |
| `node scripts/e2e.mjs` | Prueba E2E (requiere `npm start` corriendo) |

### PWA
Instalable desde el navegador ("Añadir a pantalla de inicio"): `public/manifest.webmanifest`,
service worker con página *offline* e íconos en `public/icons/` (generados por `npm run icons`).

### Despliegue
- **Local (red del negocio):** `npm start` en la PC; los celulares entran por WiFi a `http://IP_DEL_PC:3000`. Sin costo mensual.
- **Nube:** subir el proyecto a Vercel / Railway con las variables `DATABASE_URL` (usar el host con `-pooler` para entornos serverless) y `AUTH_SECRET`.
- **Respaldo:** exportación CSV desde Reportes y respaldos automáticos de la base en Neon.

---

## 9. Fases de Desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Scaffold Next.js + Tailwind + Prisma + PostgreSQL | ✅ |
| 2 | Esquema de base de datos, migraciones y datos sembrados | ✅ |
| 3 | Login PIN + layout + PWA instalable | ✅ |
| 4 | Módulo de ventas, clientes y pagos | ✅ |
| 5 | Inventario diario y cálculo de venta del día | ✅ |
| 6 | Dashboard y reportes | ✅ |
| 7 | Notificaciones en vivo (SSE + sonido + Telegram) | ✅ |
| 8 | Worker IMAP de Yape y conciliación de pagos | ✅ |
| 9 | Configuración, exportaciones y despliegue local/nube | ✅ |

Verificación automática: `node scripts/e2e.mjs` cubre login (PIN correcto e incorrecto),
las 7 páginas protegidas, alta de venta con saldo, cliente, dashboard, CSV y la
asignación de un pago Yape pendiente con recálculo de saldo.

---

## 10. Puntos Pendientes de Confirmación

- [ ] Credenciales de correo IMAP (host, usuario, contraseña de aplicación) en *Configuración → Correo Yape*.
- [ ] Cambiar el PIN inicial `1234` y completar datos del negocio + precios por marca.
- [ ] Probar la instalación de la PWA en el celular del negocio.
- [ ] (Opcional) Token de Telegram para alertas.
- [ ] (Opcional) Publicar en la nube con dominio propio.

---

*Documento generado para el cliente. Cualquier duda o cambio de alcance se acuerda antes de cada fase.*

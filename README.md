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

Esquema de tablas principales:

```
marcas            →  id, nombre, precio_defecto, activo
repartidores      →  id, nombre, telefono, activo
clientes          →  id, nombre, direccion, telefono, notas
ventas            →  id, fecha, cliente_id, direccion, telefono, premium,
                     marca_id, cantidad, valor_unitario, total,
                     a_cuenta, saldo, prestado, regresado,
                     repartidor_id, notas
pagos             →  id, fecha, venta_id, monto, metodo,
                     referencia, origen (manual/imap/webhook), estado
inventario_diario →  id, fecha, marca_id, inicio, comprados, vacios,
                     UNIQUE(fecha, marca_id)
notificaciones    →  id, tipo, titulo, mensaje, meta, leida
config            →  clave, valor  (datos del negocio, PIN, IMAP, Telegram)
email_procesado   →  id, message_id, asunto, remitente, monto, referencia
```

**Datos sembrados al instalar:**
- Marcas: Solgas, Lima Gas, Repsol, Zeta Gas, Primax (editables).
- Repartidores: Adolfo, David, Michael, Jose (editables).

---

## 6. Integración con Yape

Yape **no ofrece API pública** para cuentas personales. El sistema se conecta por **correo (IMAP)**:

1. Un **worker** revisa el buzón cada 60 segundos.
2. Cuando detecta un correo de pago Yape, extrae: **monto, pagador y código de operación**.
3. Guarda la transacción, la concilia con una venta si coincide el código, y dispara la **notificación en pantalla + sonido + Telegram**.

> **Nota:** Si el buzón no recibe los correos de Yape, el mismo adaptador permite conectar el reenvío desde el celular (MacroDroid / Tasker) o un webhook, sin rehacer el sistema.

---

## 7. Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS + PWA instalable |
| Backend | Next.js Server Actions + Route Handlers |
| Base de datos | PostgreSQL (Supabase en nube / Docker local) |
| ORM | Prisma 7 |
| Autenticación | PIN + cookie `httpOnly` firmada |
| Notificaciones | SSE + sonido + Telegram |
| Correo Yape | Worker IMAP (`imapflow` + `mailparser`) |
| Despliegue local | Docker Compose (PostgreSQL) + `npm run dev` |
| Despliegue nube | Vercel / Railway + Supabase |

---

## 8. Despliegue (Local y Nube)

- **Local:** El servidor corre en la PC del negocio; los celulares acceden por WiFi a la IP local. Sin costo mensual.
- **Nube:** La misma aplicación y base de datos (Supabase) se publican con HTTPS para acceso desde cualquier lugar.
- **Respaldo:** Exportación CSV/JSON y copias automáticas de la base de datos.

---

## 9. Fases de Desarrollo

| Fase | Contenido |
|---|---|
| 1 | Scaffold Next.js + Tailwind + Prisma + PostgreSQL |
| 2 | Esquema de base de datos, migraciones y datos sembrados |
| 3 | Login PIN + layout + PWA instalable |
| 4 | Módulo de ventas, clientes y pagos |
| 5 | Inventario diario y cálculo de venta del día |
| 6 | Dashboard y reportes |
| 7 | Notificaciones en vivo (SSE + sonido + Telegram) |
| 8 | Worker IMAP de Yape y conciliación de pagos |
| 9 | Configuración, exportaciones y despliegue local/nube |

---

## 10. Puntos Pendientes de Confirmación

- [ ] Credenciales de base de datos (Supabase o Docker local).
- [ ] Correo IMAP donde llegarían las notificaciones de Yape (host, usuario, contraseña de aplicación).
- [ ] Datos del negocio: nombre, teléfono, dirección y precios por marca.
- [ ] Confirmación del PIN inicial para el acceso.

---

*Documento generado para el cliente. Cualquier duda o cambio de alcance se acuerda antes de cada fase.*

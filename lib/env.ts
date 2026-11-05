import dotenv from "dotenv";

/**
 * Carga la configuración del proyecto con precedencia sobre el entorno:
 * `.env.local` gana sobre `.env` y sobre variables heredadas de la máquina
 * (p. ej. un DATABASE_URL global de otro proyecto).
 * En producción (Render) no hay archivos .env* — se usan las variables del servicio.
 */
dotenv.config({ path: [".env", ".env.local"], override: true });

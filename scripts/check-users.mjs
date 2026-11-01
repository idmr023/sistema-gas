import { PrismaClient } from "../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });
p.usuario.findMany().then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(e)).finally(()=>p.$disconnect());

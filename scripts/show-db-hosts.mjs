import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.startsWith("DATABASE_URL")) continue;
  const key = line.split("=")[0];
  const raw = line.slice(line.indexOf("=") + 1).replace(/^"|"$/g, "");
  const u = new URL(raw);
  console.log(key, "=>", u.host, u.pathname);
}

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./db";

(async () => {
  await pool.query(readFileSync(join(__dirname, "../../db/schema.sql"), "utf8"));
  console.log("Esquema creado/actualizado");
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

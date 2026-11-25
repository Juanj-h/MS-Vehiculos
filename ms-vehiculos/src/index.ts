import "dotenv/config";
import express from "express";
import { cuentaResponsable } from "./middleware/cuenta";
import { errorHandler } from "./middleware/errors";
import tipos from "./routes/tipos";
import vehiculos from "./routes/vehiculos";
import eventos from "./routes/eventos";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", servicio: "ms-vehiculos" }));

app.use("/api", cuentaResponsable);
app.use("/api/tipos-vehiculo", tipos);
app.use("/api/vehiculos", vehiculos);
app.use("/api/eventos", eventos);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => console.log(`MS-Vehiculos escuchando en :${port}`));

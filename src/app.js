const express = require("express");
const routes = require("./routes");
const { manejarError } = require("./errors");

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.get("/", (req, res) => res.json({ servicio: "API del gimnasio" }));
app.use("/api", routes);
app.use((req, res) => res.status(404).json({ error: "La ruta no existe." }));
app.use(manejarError);

module.exports = app;
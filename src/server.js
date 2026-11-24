require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const app = require("./app");
const prisma = require("./db/prisma");
const conectarMongo = require("./db/mongo");
const Clase = require("./models/clase");
const Valoracion = require("./models/valoracion");

async function iniciar() {
    if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
        throw new Error("Configura DATABASE_URL y JWT_SECRET en el entorno.");
    }
    await conectarMongo();
    await prisma.$connect();
    await Promise.all([Clase.init(), Valoracion.init()]);

    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => console.log("API del gimnasio en el puerto " + port));
    server.once("error", (error) => {
        console.error("No se pudo abrir el puerto de la API:", error.code || error.name);
        process.exitCode = 1;
        void cerrarBases();
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => server.close(() => void cerrarBases()));
    }
}

function cerrarBases() {
    return Promise.allSettled([mongoose.disconnect(), prisma.$disconnect()]);
}

iniciar().catch(async (error) => {
    console.error("No se pudo iniciar la API:", error.code || error.name, error.message);
    await cerrarBases();
    process.exitCode = 1;
});

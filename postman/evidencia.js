require("dotenv").config({ quiet: true });
const { randomBytes, randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const { Client } = require("pg");

const nombreBase = "gimnasio_evidencia";
const urlOriginal = process.env.DATABASE_URL;
const postgres = new URL(urlOriginal);
const mongo = new URL(process.env.MONGODB_URI);
postgres.pathname = "/" + nombreBase;
mongo.pathname = "/" + nombreBase;
process.env.DATABASE_URL = postgres.toString();
process.env.MONGODB_URI = mongo.toString();
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const prisma = require("../src/db/prisma");
const conectarMongo = require("../src/db/mongo");
const Clase = require("../src/models/clase");
const Valoracion = require("../src/models/valoracion");
const { ErrorHttp, manejarError } = require("../src/errors");

const puerto = Number(process.env.PUERTO_EVIDENCIA || 3100);
const dias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
let lote;

function fechaConDesplazamiento(diasDeDiferencia) {
    const fecha = new Date();
    fecha.setUTCDate(fecha.getUTCDate() + diasDeDiferencia);
    return fecha;
}

function correosDe(datos) {
    return [datos.admin, datos.socio, datos.otroSocio];
}

async function limpiar(datos) {
    const emails = correosDe(datos);
    const clases = await Clase.find({ instructor: datos.marca }).select("_id").lean();
    const ids = clases.map(({ _id }) => String(_id));
    const usuarios = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const userIds = usuarios.map(({ id }) => id);
    await Valoracion.deleteMany({ $or: [{ claseId: { $in: ids } }, { userId: { $in: userIds } }] });
    await prisma.$transaction([
        prisma.inscripcion.deleteMany({ where: { OR: [{ claseId: { in: ids } }, { userId: { in: userIds } }] } }),
        prisma.cupoSesion.deleteMany({ where: { claseId: { in: ids } } }),
        prisma.user.deleteMany({ where: { email: { in: emails } } }),
    ]);
    await Clase.deleteMany({ _id: { $in: ids } });
    const [clasesPendientes, valoraciones, inscripciones, sesiones, cuentas] = await Promise.all([
        Clase.countDocuments({ instructor: datos.marca }),
        Valoracion.countDocuments({ $or: [{ claseId: { $in: ids } }, { userId: { $in: userIds } }] }),
        prisma.inscripcion.count({ where: { OR: [{ claseId: { in: ids } }, { userId: { in: userIds } }] } }),
        prisma.cupoSesion.count({ where: { claseId: { in: ids } } }),
        prisma.user.count({ where: { email: { in: emails } } }),
    ]);
    return { clases: clasesPendientes, valoraciones, inscripciones, sesiones, cuentas };
}

function obtenerLote(id) {
    if (!lote || lote.id !== id) throw new ErrorHttp(404, "La ejecución no está activa.");
    return lote;
}

async function preparar(req, res) {
    if (lote) {
        throw new ErrorHttp(409, "Termina la ejecución anterior o reinicia el servidor de evidencia.");
    }
    const id = randomUUID();
    const marca = "Evidencia " + id;
    const pasada = fechaConDesplazamiento(-7);
    const futura = fechaConDesplazamiento(7);
    const datos = {
        id,
        marca,
        admin: "admin-" + id + "@example.com",
        socio: "socio-" + id + "@example.com",
        otroSocio: "otro-" + id + "@example.com",
        fechaPasada: pasada.toISOString().slice(0, 10),
        fechaFutura: futura.toISOString().slice(0, 10),
        diaSemana: dias[futura.getUTCDay()],
    };
    lote = datos;
    try {
        const password = randomBytes(18).toString("hex");
        await prisma.user.create({
            data: { name: marca, email: datos.admin, password: await bcrypt.hash(password, 10), role: "ADMIN" },
        });
        res.status(201).json({ ...datos, password });
    } catch (error) {
        lote = undefined;
        throw error;
    }
}

async function prepararAsistencia(req, res) {
    const datos = obtenerLote(req.params.id);
    const { claseId, horarioId } = req.body || {};
    if (![claseId, horarioId].every((id) => typeof id === "string" && mongoose.isObjectIdOrHexString(id))) {
        throw new ErrorHttp(400, "Envía los identificadores de la clase y su horario.");
    }
    const clase = await Clase.findOne({ _id: claseId, instructor: datos.marca });
    const horario = clase?.horarios.id(horarioId);
    if (!horario) throw new ErrorHttp(404, "El horario no pertenece a la ejecución.");
    const socio = await prisma.user.findUnique({ where: { email: datos.socio }, select: { id: true } });
    if (!socio) throw new ErrorHttp(404, "No existe el socio de la ejecución.");
    const sesion = {
        claseId: String(clase._id),
        horarioId: String(horario._id),
        fechaSesion: new Date(datos.fechaPasada),
    };
    const inscripcion = await prisma.$transaction(async (tx) => {
        await tx.cupoSesion.create({ data: { ...sesion, cupoMax: horario.cupoMax, cupoOcupado: 1 } });
        return tx.inscripcion.create({ data: { ...sesion, userId: socio.id } });
    });
    res.status(201).json({ inscripcionId: inscripcion.id });
}

async function finalizar(req, res) {
    const datos = obtenerLote(req.params.id);
    const restantes = await limpiar(datos);
    lote = undefined;
    res.json({ restantes });
}

async function iniciar() {
    const provision = new Client({ connectionString: urlOriginal });
    await provision.connect();
    try {
        const existe = await provision.query("SELECT 1 FROM pg_database WHERE datname = $1", [nombreBase]);
        if (!existe.rowCount) await provision.query('CREATE DATABASE "gimnasio_evidencia"');
    } finally {
        await provision.end();
    }

    execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
        stdio: "inherit",
        env: { ...process.env, DOTENV_CONFIG_QUIET: "true" },
    });
    await prisma.$connect();
    await conectarMongo();
    await Promise.all([Clase.init(), Valoracion.init()]);

    const servidor = express();
    servidor.use(express.json());
    servidor.get("/_evidencia", (req, res) => res.json({ base: nombreBase }));
    servidor.post("/_evidencia/preparar", preparar);
    servidor.post("/_evidencia/:id/asistencia", prepararAsistencia);
    servidor.delete("/_evidencia/:id", finalizar);
    servidor.use(manejarError);
    servidor.use(require("../src/app"));

    const http = servidor.listen(puerto, "127.0.0.1", () => {
        console.log("Servidor de evidencia en http://127.0.0.1:" + puerto);
    });
    http.once("error", (error) => {
        console.error(error.code || error.name);
        process.exitCode = 1;
        void desconectar();
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => http.close(async () => {
            try {
                if (lote) await limpiar(lote);
            } finally {
                await desconectar();
            }
        }));
    }
}

function desconectar() {
    return Promise.allSettled([mongoose.disconnect(), prisma.$disconnect()]);
}

iniciar().catch(async (error) => {
    console.error(error.code || error.name, error.message);
    await desconectar();
    process.exitCode = 1;
});

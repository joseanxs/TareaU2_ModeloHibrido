const mongoose = require("mongoose");
const prisma = require("../db/prisma");
const Clase = require("../models/clase");
const Valoracion = require("../models/valoracion");
const { ErrorHttp } = require("../errors");
const { idMongo, fechaIso, objeto, paginacion } = require("./entrada");

const camposClase = ["nombre", "descripcion", "nivel", "instructor", "activa", "horarios"];
const camposProyectables = new Set(["_id", ...camposClase, "slug"]);
const camposHorario = ["diaSemana", "horaInicio", "horaFin", "sala", "cupoMax", "temporada", "vigenteDesde", "vigenteHasta"];
const ordenes = new Set(["nombre", "-nombre", "nivel", "-nivel"]);

function datosClase(body) {
    objeto(body);
    const datos = Object.fromEntries(camposClase.filter((campo) => Object.hasOwn(body, campo)).map((campo) => [campo, body[campo]]));
    for (const campo of ["nombre", "descripcion", "nivel", "instructor"]) {
        if (Object.hasOwn(datos, campo) && typeof datos[campo] !== "string") {
            throw new ErrorHttp(400, campo + " debe ser texto.");
        }
    }
    if (Object.hasOwn(datos, "activa") && typeof datos.activa !== "boolean") {
        throw new ErrorHttp(400, "activa debe tener un valor booleano.");
    }
    if (Object.hasOwn(datos, "horarios")) {
        if (!Array.isArray(datos.horarios)) throw new ErrorHttp(400, "horarios debe ser un arreglo.");
        datos.horarios = datos.horarios.map(datosHorario);
    }
    return datos;
}

function datosHorario(body) {
    objeto(body);
    const horario = Object.fromEntries(camposHorario.map((campo) => [campo, body[campo]]));
    if (body._id !== undefined) horario._id = idMongo(body._id, "horario._id");
    for (const campo of ["diaSemana", "horaInicio", "horaFin", "sala", "temporada"]) {
        if (typeof horario[campo] !== "string") throw new ErrorHttp(400, "horario." + campo + " debe ser texto.");
        horario[campo] = horario[campo].trim();
    }
    if (typeof horario.cupoMax !== "number") throw new ErrorHttp(400, "horario.cupoMax debe ser un número.");
    for (const campo of ["vigenteDesde", "vigenteHasta"]) {
        const valor = horario[campo];
        const fecha = typeof valor === "string" && valor.endsWith("T00:00:00.000Z") ? valor.slice(0, -14) : valor;
        horario[campo] = fechaIso(fecha, "horario." + campo);
    }
    return horario;
}

async function conBloqueoClase(claseId, operacion) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${claseId}::text, 0))::text AS bloqueo`;
        return operacion(tx);
    }, { timeout: 15000 });
}

async function crearClase(body) {
    return Clase.create(datosClase(body));
}

async function listarClases({ q, fields, orden = "nombre", ...query }) {
    const { skip, take } = paginacion(query);
    if (typeof orden !== "string" || !ordenes.has(orden)) {
        throw new ErrorHttp(400, "El orden debe ser nombre, -nombre, nivel o -nivel.");
    }
    const filtro = {};
    if (q !== undefined) {
        if (typeof q !== "string" || q.length > 100) {
            throw new ErrorHttp(400, "q debe contener hasta 100 caracteres.");
        }
        const texto = q.trim();
        if (texto) {
            const escapa = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filtro.nombre = { $regex: escapa, $options: "i" };
        }
    }

    const consulta = Clase.find(filtro).sort(orden + " _id").skip(skip).limit(take);
    if (fields === undefined) return consulta;

    if (typeof fields !== "string") throw new ErrorHttp(400, "fields debe ser una lista separada por comas.");
    const campos = fields.split(",").map((campo) => campo.trim()).filter(Boolean);
    if (campos.length === 0 || campos.some((campo) => !camposProyectables.has(campo))) {
        throw new ErrorHttp(400, "fields contiene un campo que no se puede proyectar.");
    }
    return consulta.select(campos.join(" ")).lean();
}

async function obtenerClase(id) {
    const clase = await Clase.findById(idMongo(id, "id"));
    if (!clase) throw new ErrorHttp(404, "La clase no existe.");
    return clase;
}

async function obtenerHorario(claseId, horarioId, verificarClase = false) {
    if (verificarClase && !(await Clase.exists({ _id: claseId }))) {
        throw new ErrorHttp(404, "La clase no existe.");
    }
    const clase = await Clase.findById(claseId, { activa: 1, horarios: { $elemMatch: { _id: new mongoose.Types.ObjectId(horarioId) } } });
    if (!clase) throw new ErrorHttp(404, "La clase no existe.");
    const horario = clase.horarios?.[0];
    if (!horario) throw new ErrorHttp(404, "El horario no pertenece a la clase.");
    return { clase, horario };
}

async function actualizarClase(id, body) {
    const claseId = idMongo(id, "id");
    const datos = datosClase(body);
    if (Object.keys(datos).length === 0) throw new ErrorHttp(400, "Envía al menos un campo de la clase.");

    return conBloqueoClase(claseId, async (tx) => {
        const clase = await obtenerClase(claseId);
        if (Object.hasOwn(datos, "horarios")) {
            const publicados = await tx.cupoSesion.findMany({
                where: { claseId },
                distinct: ["horarioId"],
                select: { horarioId: true },
            });
            const nuevos = new Map(datos.horarios.map((horario) => [horario._id, horario]));
            for (const { horarioId } of publicados) {
                const anterior = clase.horarios.id(horarioId);
                const nuevo = nuevos.get(horarioId);
                const modificado = !anterior || !nuevo || camposHorario.some((campo) => String(anterior[campo]) !== String(nuevo[campo]));
                if (modificado) throw new ErrorHttp(409, "Conserva los datos de los horarios con sesiones publicadas.");
            }
        }
        clase.set(datos);
        return clase.save();
    });
}

async function eliminarClase(id) {
    const claseId = idMongo(id, "id");
    return conBloqueoClase(claseId, async (tx) => {
        if (!(await Clase.exists({ _id: claseId }))) throw new ErrorHttp(404, "La clase no existe.");
        const [sesion, inscripcion] = await Promise.all([
            tx.cupoSesion.findFirst({ where: { claseId }, select: { claseId: true } }),
            tx.inscripcion.findFirst({ where: { claseId }, select: { id: true } }),
        ]);
        if (sesion || inscripcion) throw new ErrorHttp(409, "La clase tiene sesiones o inscripciones en PostgreSQL.");
        await Valoracion.deleteMany({ claseId });
        await Clase.deleteOne({ _id: claseId });
    });
}

module.exports = { crearClase, listarClases, obtenerClase, actualizarClase, eliminarClase, obtenerHorario, conBloqueoClase };

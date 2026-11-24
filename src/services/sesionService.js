const prisma = require("../db/prisma");
const { ErrorHttp } = require("../errors");
const { conBloqueoClase, obtenerHorario } = require("./claseService");
const { idMongo, idPostgres, fechaIso, objeto, paginacion } = require("./entrada");

const dias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const reloj = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ_GIMNASIO || "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

function claveSesion(body) {
    objeto(body);
    return {
        claseId: idMongo(body.claseId, "claseId"),
        horarioId: idMongo(body.horarioId, "horarioId"),
        fechaSesion: fechaIso(body.fechaSesion, "fechaSesion"),
    };
}

function fechaTexto(fecha) {
    return fecha.toISOString().slice(0, 10);
}

function yaLlegoLaHora(fecha, hora) {
    const partes = Object.fromEntries(reloj.formatToParts(new Date()).map(({ type, value }) => [type, value]));
    const ahora = partes.year + "-" + partes.month + "-" + partes.day + "T" + partes.hour + ":" + partes.minute;
    return ahora >= fechaTexto(fecha) + "T" + hora;
}

async function bloquearSesion(tx, { claseId, horarioId, fechaSesion }) {
    const filas = await tx.$queryRaw`
        SELECT "cupoMax", "cupoOcupado"
        FROM "CupoSesion"
        WHERE "claseId" = ${claseId} AND "horarioId" = ${horarioId} AND "fechaSesion" = ${fechaTexto(fechaSesion)}::date
        FOR UPDATE
    `;
    if (!filas.length) throw new ErrorHttp(404, "La sesión no está publicada.");
    return filas[0];
}

async function publicarSesion(body) {
    const clave = claveSesion(body);
    return conBloqueoClase(clave.claseId, async (tx) => {
        const { clase, horario } = await obtenerHorario(clave.claseId, clave.horarioId, true);
        if (!clase.activa) throw new ErrorHttp(409, "La clase está desactivada.");
        if (clave.fechaSesion < horario.vigenteDesde || clave.fechaSesion > horario.vigenteHasta ||
            dias[clave.fechaSesion.getUTCDay()] !== horario.diaSemana) {
            throw new ErrorHttp(400, "La fecha debe coincidir con el día y la vigencia del horario.");
        }
        return tx.cupoSesion.create({ data: { ...clave, cupoMax: horario.cupoMax } });
    });
}

async function listarSesiones({ claseId, ...query }) {
    const filtro = claseId === undefined ? {} : { claseId: idMongo(claseId, "claseId") };
    return prisma.cupoSesion.findMany({
        where: filtro,
        orderBy: [{ fechaSesion: "asc" }, { claseId: "asc" }, { horarioId: "asc" }],
        ...paginacion(query),
    });
}

async function registrarAsistencia(body) {
    const clave = claveSesion(body);
    if (!Array.isArray(body.asistieron)) {
        throw new ErrorHttp(400, "Envía los identificadores de inscripción en el arreglo asistieron.");
    }
    const asistieron = [...new Set(body.asistieron.map((id) => idPostgres(id, "inscripcionId")))];
    const { horario } = await obtenerHorario(clave.claseId, clave.horarioId);

    return prisma.$transaction(async (tx) => {
        await bloquearSesion(tx, clave);
        if (!yaLlegoLaHora(clave.fechaSesion, horario.horaFin)) {
            throw new ErrorHttp(409, "La sesión todavía no termina.");
        }
        const activas = { ...clave, estado: "ACTIVA" };
        const confirmadas = await tx.inscripcion.updateMany({
            where: { ...activas, id: { in: asistieron } },
            data: { estado: "ASISTIDA" },
        });
        if (confirmadas.count !== asistieron.length) {
            throw new ErrorHttp(409, "Todos los identificadores deben pertenecer a inscripciones activas de esta sesión.");
        }
        const ausentes = await tx.inscripcion.updateMany({ where: activas, data: { estado: "NO_ASISTIO" } });
        return { asistidas: confirmadas.count, ausentes: ausentes.count };
    });
}

module.exports = { claveSesion, yaLlegoLaHora, bloquearSesion, publicarSesion, listarSesiones, registrarAsistencia };

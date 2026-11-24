const prisma = require("../db/prisma");
const Clase = require("../models/clase");
const { ErrorHttp } = require("../errors");
const { idPostgres, paginacion } = require("./entrada");
const { obtenerHorario } = require("./claseService");
const { claveSesion, yaLlegoLaHora, bloquearSesion } = require("./sesionService");

function validarHora(fecha, hora) {
    if (yaLlegoLaHora(fecha, hora)) throw new ErrorHttp(409, "La sesión ya inició.");
}

async function crearInscripcion(body, userId) {
    const clave = claveSesion(body);
    const { horario } = await obtenerHorario(clave.claseId, clave.horarioId, true);
    return prisma.$transaction(async (tx) => {
        const sesion = await bloquearSesion(tx, clave);
        validarHora(clave.fechaSesion, horario.horaInicio);
        if (sesion.cupoOcupado >= sesion.cupoMax) throw new ErrorHttp(409, "La sesión no tiene cupos libres.");

        const inscripcion = await tx.inscripcion.create({ data: { ...clave, userId } });
        await tx.cupoSesion.update({
            where: { claseId_horarioId_fechaSesion: clave },
            data: { cupoOcupado: { increment: 1 } },
        });
        return inscripcion;
    });
}

async function cancelarInscripcion(id, userId) {
    const inscripcion = await prisma.inscripcion.findUnique({ where: { id: idPostgres(id, "id") } });
    if (!inscripcion) throw new ErrorHttp(404, "La inscripción no existe.");
    if (inscripcion.userId !== userId) throw new ErrorHttp(403, "La inscripción pertenece a otro usuario.");

    const { claseId, horarioId, fechaSesion } = inscripcion;
    if (!claseId) throw new ErrorHttp(409, "La inscripción no está asociada a una clase.");
    const clave = { claseId, horarioId, fechaSesion };
    const { horario } = await obtenerHorario(claseId, horarioId);

    return prisma.$transaction(async (tx) => {
        await bloquearSesion(tx, clave);
        validarHora(fechaSesion, horario.horaInicio);
        const cambio = await tx.inscripcion.updateMany({
            where: { id: inscripcion.id, estado: "ACTIVA" },
            data: { estado: "CANCELADA" },
        });
        if (!cambio.count) throw new ErrorHttp(409, "Solo se pueden cancelar inscripciones activas.");
        await tx.cupoSesion.update({
            where: { claseId_horarioId_fechaSesion: clave },
            data: { cupoOcupado: { decrement: 1 } },
        });
        return { ...inscripcion, estado: "CANCELADA" };
    });
}

async function listarInscripciones(query, user) {
    const where = user.role === "ADMIN" ? {} : { userId: user.id };
    const inscripciones = await prisma.inscripcion.findMany({
        where,
        orderBy: [{ fechaSesion: "desc" }, { id: "desc" }],
        ...paginacion(query),
    });

    const ids = [...new Set(inscripciones.map(({ claseId }) => claseId).filter(Boolean))];
    const clases = ids.length
        ? await Clase.find({ _id: { $in: ids } }).select("nombre nivel horarios").lean()
        : [];
    const porClase = new Map(clases.map((clase) => [String(clase._id), clase]));

    return inscripciones.map((inscripcion) => {
        const clase = porClase.get(inscripcion.claseId);
        if (!clase) return { ...inscripcion, clase: null };
        const horario = clase.horarios.find((item) => String(item._id) === inscripcion.horarioId);
        return {
            ...inscripcion,
            clase: { _id: clase._id, nombre: clase.nombre, nivel: clase.nivel, horario: horario || null },
        };
    });
}

module.exports = { crearInscripcion, cancelarInscripcion, listarInscripciones };

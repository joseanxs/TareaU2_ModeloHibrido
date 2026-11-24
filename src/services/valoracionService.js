const { Types } = require("mongoose");
const prisma = require("../db/prisma");
const Clase = require("../models/clase");
const Valoracion = require("../models/valoracion");
const { ErrorHttp } = require("../errors");
const { idMongo, idPostgres, objeto, paginacion } = require("./entrada");

async function crearValoracion(body, userId) {
    objeto(body);
    const inscripcionId = idPostgres(body.inscripcionId, "inscripcionId");
    if (typeof body.puntuacion !== "number") {
        throw new ErrorHttp(400, "La puntuación debe ser un número.");
    }
    if (body.comentario !== undefined && typeof body.comentario !== "string") {
        throw new ErrorHttp(400, "El comentario debe ser texto.");
    }

    const inscripcion = await prisma.inscripcion.findUnique({ where: { id: inscripcionId } });
    if (!inscripcion) throw new ErrorHttp(404, "La inscripción no existe.");
    if (inscripcion.userId !== userId) throw new ErrorHttp(403, "La inscripción pertenece a otro usuario.");
    if (inscripcion.estado !== "ASISTIDA") throw new ErrorHttp(409, "Solo se pueden valorar inscripciones con asistencia registrada.");
    if (!inscripcion.claseId || !(await Clase.exists({ _id: inscripcion.claseId }))) {
        throw new ErrorHttp(404, "La clase de la inscripción no existe.");
    }

    try {
        return await Valoracion.create({
            inscripcionId,
            userId,
            claseId: inscripcion.claseId,
            puntuacion: body.puntuacion,
            comentario: body.comentario,
        });
    } catch (error) {
        if (error.code === 11000) throw new ErrorHttp(409, "La inscripción ya tiene una valoración.");
        throw error;
    }
}

async function listarValoraciones({ claseId, ...query }) {
    const id = new Types.ObjectId(idMongo(claseId, "claseId"));
    if (!(await Clase.exists({ _id: id }))) throw new ErrorHttp(404, "La clase no existe.");
    const { skip, take } = paginacion(query);
    const filtro = { claseId: id };
    const [datos, resumen] = await Promise.all([
        Valoracion.find(filtro).sort({ fecha: -1, _id: -1 }).skip(skip).limit(take)
            .populate("claseId", "nombre nivel").lean(),
        Valoracion.aggregate([
            { $match: filtro },
            { $group: { _id: null, total: { $sum: 1 }, promedio: { $avg: "$puntuacion" } } },
            { $project: { _id: 0 } },
        ]),
    ]);

    return { datos, resumen: resumen[0] || { total: 0, promedio: null } };
}

module.exports = { crearValoracion, listarValoraciones };

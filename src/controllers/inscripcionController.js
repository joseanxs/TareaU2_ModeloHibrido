const inscripcion = require("../services/inscripcionService");

async function crear(req, res) {
    res.status(201).json(await inscripcion.crearInscripcion(req.body, req.user.id));
}

async function cancelar(req, res) {
    res.json(await inscripcion.cancelarInscripcion(req.params.id, req.user.id));
}

async function listar(req, res) {
    res.json(await inscripcion.listarInscripciones(req.query, req.user));
}

module.exports = { crear, cancelar, listar };
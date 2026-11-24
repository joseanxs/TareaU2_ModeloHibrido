const clases = require("../services/claseService");

async function crear(req, res) {
    res.status(201).json(await clases.crearClase(req.body));
}

async function listar(req, res) {
    res.json(await clases.listarClases(req.query));
}

async function obtener(req, res) {
    res.json(await clases.obtenerClase(req.params.id));
}

async function actualizar(req, res) {
    res.json(await clases.actualizarClase(req.params.id, req.body));
}

async function eliminar(req, res) {
    await clases.eliminarClase(req.params.id);
    res.status(204).end();
}

module.exports = { crear, listar, obtener, actualizar, eliminar };

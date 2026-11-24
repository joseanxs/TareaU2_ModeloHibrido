const valoracion = require("../services/valoracionService");

async function crear(req, res) {
    res.status(201).json(await valoracion.crearValoracion(req.body, req.user.id));
}

async function listar(req, res) {
    res.json(await valoracion.listarValoraciones(req.query));
}

module.exports = { crear, listar };

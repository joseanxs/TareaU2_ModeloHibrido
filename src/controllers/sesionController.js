const sesion = require("../services/sesionService");

async function publicar(req, res) {
    res.status(201).json(await sesion.publicarSesion(req.body));
}

async function listar(req, res) {
    res.json(await sesion.listarSesiones(req.query));
}

async function asistencia(req, res) {
    res.json(await sesion.registrarAsistencia(req.body));
}

module.exports = { publicar, listar, asistencia };

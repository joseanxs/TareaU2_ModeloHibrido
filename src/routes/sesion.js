const { Router } = require("express");
const sesion = require("../controllers/sesionController");
const { autenticar, soloAdministrador } = require("../middlewares/auth");

const router = Router();
router.get("/", sesion.listar);
router.post("/", autenticar, soloAdministrador, sesion.publicar);
router.patch("/asistencia", autenticar, soloAdministrador, sesion.asistencia);

module.exports = router;

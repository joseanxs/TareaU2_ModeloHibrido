const { Router } = require("express");
const valoracion = require("../controllers/valoracionController");
const { autenticar } = require("../middlewares/auth");

const router = Router();
router.get("/", valoracion.listar);
router.post("/", autenticar, valoracion.crear);

module.exports = router;

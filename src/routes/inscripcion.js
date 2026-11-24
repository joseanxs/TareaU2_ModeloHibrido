const { Router } = require("express");
const inscripcion = require("../controllers/inscripcionController");
const { autenticar } = require("../middlewares/auth");

const router = Router();
router.use(autenticar);
router.get("/", inscripcion.listar);
router.post("/", inscripcion.crear);
router.patch("/:id/cancelar", inscripcion.cancelar);

module.exports = router;

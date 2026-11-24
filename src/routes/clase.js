const { Router } = require("express");
const clase = require("../controllers/claseController");
const { autenticar, soloAdministrador } = require("../middlewares/auth");

const router = Router();
router.get("/", clase.listar);
router.get("/:id", clase.obtener);
router.post("/", autenticar, soloAdministrador, clase.crear);
router.put("/:id", autenticar, soloAdministrador, clase.actualizar);
router.delete("/:id", autenticar, soloAdministrador, clase.eliminar);

module.exports = router;

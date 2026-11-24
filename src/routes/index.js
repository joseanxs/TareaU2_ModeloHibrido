const { Router } = require("express");

const router = Router();

router.use("/auth", require("./auth"));
router.use("/clases", require("./clase"));
router.use("/sesiones", require("./sesion"));
router.use("/inscripciones", require("./inscripcion"));
router.use("/valoraciones", require("./valoracion"));

module.exports = router;

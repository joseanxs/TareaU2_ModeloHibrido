class ErrorHttp extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function manejarError(error, req, res, next) {
    if (res.headersSent) return next(error);

    if (error instanceof ErrorHttp) {
        return res.status(error.status).json({ error: error.message });
    }
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "El cuerpo debe contener JSON válido." });
    }
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "El cuerpo supera el tamaño permitido." });
    }
    if (error.name === "ValidationError") {
        const detalles = Object.values(error.errors).map((item) => item.message);
        return res.status(400).json({ error: "Los datos no son válidos.", detalles });
    }
    if (error.code === "P2002" || error.code === 11000) {
        return res.status(409).json({ error: "Ya existe un registro con estos datos." });
    }
    console.error("Error de la API:", error.code || error.name);
    return res.status(500).json({ error: "Ocurrió un error interno." });
}

module.exports = { ErrorHttp, manejarError };

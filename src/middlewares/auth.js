const jwt = require("jsonwebtoken");
const { ErrorHttp } = require("../errors");

function autenticar(req, res, next) {
    const token = req.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return next(new ErrorHttp(401, "Envía el token Bearer."));

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        if (!Number.isInteger(user.id) || user.id <= 0 || !["ADMIN", "USER"].includes(user.role)) {
            throw new ErrorHttp(403, "El token no es válido.");
        }
        req.user = user;
        return next();
    } catch {
        return next(new ErrorHttp(403, "El token no es válido o ha expirado."));
    }
}

function soloAdministrador(req, res, next) {
    if (req.user.role !== "ADMIN") {
        return next(new ErrorHttp(403, "Esta operación requiere el rol de administrador."));
    }
    return next();
}

module.exports = { autenticar, soloAdministrador };

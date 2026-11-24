const mongoose = require("mongoose");
const { ErrorHttp } = require("../errors");

function idMongo(valor, campo) {
    if (typeof valor !== "string" || !mongoose.isObjectIdOrHexString(valor) || !mongoose.isValidObjectId(valor)) {
        throw new ErrorHttp(400, campo + " debe ser un ObjectId válido.");
    }
    return valor.toLowerCase();
}

function idPostgres(valor, campo) {
    if ((typeof valor !== "number" && typeof valor !== "string") || !/^[1-9]\d*$/.test(String(valor))) {
        throw new ErrorHttp(400, campo + " debe ser un entero positivo.");
    }
    const id = Number(valor);
    if (!Number.isInteger(id) || id > 2147483647) {
        throw new ErrorHttp(400, campo + " supera el rango admitido.");
    }
    return id;
}

function fechaIso(valor, campo) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        throw new ErrorHttp(400, campo + " debe tener el formato AAAA-MM-DD.");
    }
    const fecha = new Date(valor + "T00:00:00.000Z");
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor || fecha.getUTCFullYear() === 0) {
        throw new ErrorHttp(400, campo + " debe ser una fecha válida.");
    }
    return fecha;
}

function objeto(valor) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        throw new ErrorHttp(400, "Envía un objeto JSON.");
    }
    return valor;
}

function paginacion({ limite = "50", pagina = "1" }) {
    const cantidad = idPostgres(limite, "limite");
    const numero = idPostgres(pagina, "pagina");
    if (cantidad > 100 || numero > 10000) {
        throw new ErrorHttp(400, "El límite máximo es 100 y la página máxima es 10000.");
    }
    return { skip: (numero - 1) * cantidad, take: cantidad };
}

module.exports = { idMongo, idPostgres, fechaIso, objeto, paginacion };

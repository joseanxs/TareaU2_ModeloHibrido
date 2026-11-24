const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const isEmail = require("validator/lib/isEmail");
const prisma = require("../db/prisma");
const { ErrorHttp } = require("../errors");

function normalizarEmail(email) {
    if (typeof email !== "string" || !isEmail(email.trim())) {
        throw new ErrorHttp(400, "El correo electrónico no es válido.");
    }
    return email.trim().toLowerCase();
}

function validarPassword(password) {
    if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
        throw new ErrorHttp(400, "La contraseña debe tener al menos 8 caracteres y hasta 72 bytes.");
    }
}

async function registerUser({ email, password, name }) {
    const correo = normalizarEmail(email);
    validarPassword(password);
    if (typeof name !== "string" || !name.trim() || name.length > 100) {
        throw new ErrorHttp(400, "El nombre debe tener entre 1 y 100 caracteres.");
    }
    return prisma.user.create({
        data: {
            email: correo,
            password: await bcrypt.hash(password, 10),
            name: name.trim(),
            role: "USER",
        },
        select: { id: true, email: true, name: true, role: true },
    });
}

async function loginUser({ email, password }) {
    const correo = normalizarEmail(email);
    validarPassword(password);
    const user = await prisma.user.findUnique({ where: { email: correo } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new ErrorHttp(401, "El correo o la contraseña son incorrectos.");
    }
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: "4h",
    });
}

module.exports = { registerUser, loginUser, normalizarEmail, validarPassword };

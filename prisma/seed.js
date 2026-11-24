require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const prisma = require("../src/db/prisma");
const { normalizarEmail, validarPassword } = require("../src/services/authService");

async function crearAdministrador() {
    const email = normalizarEmail(process.env.ADMIN_EMAIL);
    const password = process.env.ADMIN_PASSWORD;
    validarPassword(password);
    if (password === "CAMBIAR_PASSWORD_ADMIN") {
        throw new Error("Configura ADMIN_PASSWORD antes de crear la cuenta.");
    }

    const admin = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: await bcrypt.hash(password, 10), name: "Administrador", role: "ADMIN" },
        select: { role: true },
    });
    if (admin.role !== "ADMIN") {
        throw new Error("El correo ya pertenece a una cuenta sin rol de administrador.");
    }
    console.log("Cuenta de administrador disponible.");
}

crearAdministrador()
    .catch((error) => {
        console.error(error.code || error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

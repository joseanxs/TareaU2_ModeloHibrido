const { registerUser, loginUser } = require("../services/authService");

async function registrar(req, res) {
    const user = await registerUser(req.body || {});
    res.status(201).json(user);
}

async function iniciarSesion(req, res) {
    const token = await loginUser(req.body || {});
    res.json({ token });
}

module.exports = { registrar, iniciarSesion };

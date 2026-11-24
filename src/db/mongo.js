const mongoose = require("mongoose");

async function conectarMongo() {
    if (!process.env.MONGODB_URI) {
        throw new Error("Configura MONGODB_URI en el entorno.");
    }
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
}

module.exports = conectarMongo;

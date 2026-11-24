const mongoose = require("mongoose");

const valoracionSchema = new mongoose.Schema(
    {
        inscripcionId: { type: Number, required: [true, "La inscripción es obligatoria."] },
        userId: { type: Number, required: [true, "El usuario es obligatorio."] },
        claseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Clase",
            required: [true, "La clase es obligatoria."],
        },
        puntuacion: {
            type: Number,
            required: [true, "La puntuación es obligatoria."],
            min: [1, "La puntuación mínima es 1."],
            max: [5, "La puntuación máxima es 5."],
            validate: { validator: Number.isInteger, message: "La puntuación debe ser un número entero." },
        },
        comentario: { type: String, trim: true, maxlength: [500, "El comentario admite hasta 500 caracteres."] },
        fecha: { type: Date, default: Date.now },
    },
    { versionKey: false, collection: "valoraciones" },
);

valoracionSchema.index({ inscripcionId: 1 }, { unique: true });
valoracionSchema.index({ claseId: 1, fecha: -1, _id: -1 });

module.exports = mongoose.model("Valoracion", valoracionSchema);

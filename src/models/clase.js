const mongoose = require("mongoose");
const slugify = require("slugify");

const formatoHora = [/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Usa una hora válida con formato HH:mm."];

const horarioSchema = new mongoose.Schema(
    {
        diaSemana: {
            type: String,
            required: [true, "El día de la semana es obligatorio."],
            enum: {
                values: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"],
                message: "El día de la semana no es válido.",
            },
        },
        horaInicio: { type: String, required: [true, "La hora de inicio es obligatoria."], match: formatoHora },
        horaFin: {
            type: String,
            required: [true, "La hora de fin es obligatoria."],
            match: formatoHora,
            validate: {
                validator(hora) {
                    return hora > this.horaInicio;
                },
                message: "La hora de fin debe ser posterior a la hora de inicio.",
            },
        },
        sala: { type: String, trim: true, required: [true, "La sala es obligatoria."], maxlength: [60, "La sala admite hasta 60 caracteres."] },
        cupoMax: {
            type: Number,
            required: [true, "El cupo es obligatorio."],
            min: [1, "El cupo mínimo es 1."],
            max: [1000, "El cupo máximo es 1000."],
            validate: { validator: Number.isInteger, message: "El cupo debe ser un número entero." },
        },
        temporada: { type: String, trim: true, required: [true, "La temporada es obligatoria."] },
        vigenteDesde: { type: Date, required: [true, "La fecha desde la que está vigente el horario es obligatoria."] },
        vigenteHasta: {
            type: Date,
            required: [true, "La fecha hasta la que está vigente el horario es obligatoria."],
            validate: {
                validator(fecha) {
                    return fecha >= this.vigenteDesde;
                },
                message: "La vigencia final debe ser igual o posterior a la inicial.",
            },
        },
    },
    { versionKey: false },
);

const claseSchema = new mongoose.Schema(
    {
        nombre: {
            type: String,
            trim: true,
            required: [true, "El nombre es obligatorio."],
            minlength: [3, "El nombre debe tener al menos 3 caracteres."],
            maxlength: [100, "El nombre admite hasta 100 caracteres."],
        },
        descripcion: {
            type: String,
            trim: true,
            required: [true, "La descripción es obligatoria."],
            minlength: [10, "La descripción debe tener al menos 10 caracteres."],
            maxlength: [300, "La descripción admite hasta 300 caracteres."],
        },
        nivel: {
            type: String,
            required: [true, "El nivel es obligatorio."],
            enum: { values: ["BASICO", "INTERMEDIO", "AVANZADO"], message: "El nivel no es válido." },
        },
        instructor: { type: String, trim: true, required: [true, "El instructor es obligatorio."], maxlength: [100, "El instructor admite hasta 100 caracteres."] },
        activa: { type: Boolean, default: true, required: [true, "Indica si la clase está activa."] },
        horarios: {
            type: [horarioSchema],
            validate: {
                validator(horarios) {
                    return new Set(horarios.map((horario) => String(horario._id))).size === horarios.length;
                },
                message: "Los horarios deben tener identificadores distintos.",
            },
        },
        slug: { type: String, required: [true, "El nombre debe incluir letras o números."] },
    },
    { toJSON: { virtuals: true }, id: false, versionKey: false, collection: "clases" },
);

claseSchema.virtual("ficha").get(function () {
    if (!this.nombre || !this.nivel) return undefined;
    return this.nombre + " · " + this.nivel;
});

claseSchema.pre("validate", function () {
    if (this.nombre) this.slug = slugify(this.nombre, { lower: true, strict: true, locale: "es" });
});

module.exports = mongoose.model("Clase", claseSchema);

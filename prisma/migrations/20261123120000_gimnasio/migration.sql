CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "EstadoInscripcion" AS ENUM ('ACTIVA', 'CANCELADA', 'ASISTIDA', 'NO_ASISTIO');

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CupoSesion" (
    "claseId" CHAR(24) NOT NULL,
    "horarioId" CHAR(24) NOT NULL,
    "fechaSesion" DATE NOT NULL,
    "cupoMax" INTEGER NOT NULL,
    "cupoOcupado" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CupoSesion_pkey" PRIMARY KEY ("claseId", "horarioId", "fechaSesion"),
    CONSTRAINT "CupoSesion_cupo_check" CHECK ("cupoMax" > 0 AND "cupoOcupado" BETWEEN 0 AND "cupoMax")
);

CREATE TABLE "Inscripcion" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "claseId" CHAR(24),
    "horarioId" CHAR(24) NOT NULL,
    "fechaSesion" DATE NOT NULL,
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'ACTIVA',
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Inscripcion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inscripcion_claseId_horarioId_fechaSesion_fkey"
        FOREIGN KEY ("claseId", "horarioId", "fechaSesion")
        REFERENCES "CupoSesion"("claseId", "horarioId", "fechaSesion") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Inscripcion_claseId_idx" ON "Inscripcion"("claseId");
CREATE INDEX "Inscripcion_claseId_horarioId_fechaSesion_idx" ON "Inscripcion"("claseId", "horarioId", "fechaSesion");
CREATE INDEX "Inscripcion_userId_idx" ON "Inscripcion"("userId");
CREATE UNIQUE INDEX "Inscripcion_socio_sesion_vigente_key"
    ON "Inscripcion"("userId", "claseId", "horarioId", "fechaSesion")
    WHERE "estado" <> 'CANCELADA';

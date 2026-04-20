/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "threecplusUserId" INTEGER,
    "threecplusAgentId" INTEGER,
    "threecplusAgentToken" TEXT,
    "threecplusExtension" TEXT,
    "instanciaWhatsappId" TEXT,
    "instanciaWhatsappNome" TEXT,
    "grupoCanaisId" TEXT,
    "grupoCanaisNome" TEXT,
    "campanhaId" INTEGER,
    "campanhaNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

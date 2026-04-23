-- CreateTable
CREATE TABLE "instancia_whatsapp_user" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instancia_whatsapp_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instancia_whatsapp_user_instanciaId_idx" ON "instancia_whatsapp_user"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "instancia_whatsapp_user_userId_instanciaId_key" ON "instancia_whatsapp_user"("userId", "instanciaId");

-- AddForeignKey
ALTER TABLE "instancia_whatsapp_user" ADD CONSTRAINT "instancia_whatsapp_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

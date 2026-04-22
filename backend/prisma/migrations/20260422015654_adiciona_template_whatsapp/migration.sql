-- CreateTable
CREATE TABLE "template_whatsapp" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "icone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_whatsapp_categoria_ativo_idx" ON "template_whatsapp"("categoria", "ativo");

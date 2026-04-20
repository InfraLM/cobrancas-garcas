-- CreateTable
CREATE TABLE "error_logs" (
    "id" SERIAL NOT NULL,
    "metodo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "stack" TEXT,
    "userId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_criadoEm_idx" ON "error_logs"("criadoEm" DESC);

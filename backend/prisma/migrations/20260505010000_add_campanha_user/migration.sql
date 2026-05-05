-- CreateTable
CREATE TABLE "cobranca"."campanha_user" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "campanhaId" INTEGER NOT NULL,
    "campanhaNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanha_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campanha_user_campanhaId_idx" ON "cobranca"."campanha_user"("campanhaId");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_user_userId_campanhaId_key" ON "cobranca"."campanha_user"("userId", "campanhaId");

-- AddForeignKey
ALTER TABLE "cobranca"."campanha_user" ADD CONSTRAINT "campanha_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cobranca"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

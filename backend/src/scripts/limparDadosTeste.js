/**
 * Limpa dados operacionais/CRM gerados durante testes para iniciar a operacao real.
 *
 * Tabelas que este script limpa (TODAS as linhas):
 *   - ocorrencia
 *   - mensagem_whatsapp
 *   - conversa_cobranca
 *   - evento_ligacao_raw
 *   - registro_ligacao
 *
 * Tabelas preservadas (NAO toca):
 *   - user, regra_segmentacao, template_whatsapp (config)
 *   - contareceber, pessoa, matricula e demais tabelas SEI (sync)
 *   - pf_alunos, pf_plantoes, serasa, blip_* (JSON/API externos)
 *   - aluno_resumo (sync)
 *
 * Uso:
 *   # Dry-run (mostra contagens, nao deleta)
 *   node --env-file=.env src/scripts/limparDadosTeste.js
 *
 *   # Executar de verdade (requer confirmacao)
 *   LIMPAR_CONFIRMAR=sim node --env-file=.env src/scripts/limparDadosTeste.js
 */

import { prisma } from '../config/database.js';

const CONFIRMAR = process.env.LIMPAR_CONFIRMAR === 'sim';

async function main() {
  console.log('=== Limpeza de dados operacionais ===\n');

  const antes = {
    ocorrencia: await prisma.ocorrencia.count(),
    mensagem_whatsapp: await prisma.mensagemWhatsapp.count(),
    conversa_cobranca: await prisma.conversaCobranca.count(),
    evento_ligacao_raw: await prisma.eventoLigacaoRaw.count(),
    registro_ligacao: await prisma.registroLigacao.count(),
  };

  console.log('Registros encontrados:');
  for (const [tabela, count] of Object.entries(antes)) {
    console.log(`  ${tabela.padEnd(28)}: ${count}`);
  }

  if (!CONFIRMAR) {
    console.log('\nDRY-RUN — nada foi deletado.');
    console.log('Para executar de verdade, rode de novo com:');
    console.log('  LIMPAR_CONFIRMAR=sim node --env-file=.env src/scripts/limparDadosTeste.js');
    return;
  }

  console.log('\nLIMPAR_CONFIRMAR=sim — executando deletes...\n');

  // Ordem respeita dependencias: primeiro as tabelas que referenciam outras.
  // ocorrencia referencia mensagem_whatsapp e registro_ligacao via FKs opcionais.
  // mensagem_whatsapp referencia conversa_cobranca indiretamente (nao tem FK).
  // evento_ligacao_raw nao tem FKs.
  const resultados = {};

  resultados.ocorrencia = await prisma.ocorrencia.deleteMany({});
  console.log(`  ocorrencia:           ${resultados.ocorrencia.count} linhas removidas`);

  resultados.mensagem_whatsapp = await prisma.mensagemWhatsapp.deleteMany({});
  console.log(`  mensagem_whatsapp:    ${resultados.mensagem_whatsapp.count} linhas removidas`);

  resultados.evento_ligacao_raw = await prisma.eventoLigacaoRaw.deleteMany({});
  console.log(`  evento_ligacao_raw:   ${resultados.evento_ligacao_raw.count} linhas removidas`);

  resultados.registro_ligacao = await prisma.registroLigacao.deleteMany({});
  console.log(`  registro_ligacao:     ${resultados.registro_ligacao.count} linhas removidas`);

  resultados.conversa_cobranca = await prisma.conversaCobranca.deleteMany({});
  console.log(`  conversa_cobranca:    ${resultados.conversa_cobranca.count} linhas removidas`);

  const total = Object.values(resultados).reduce((acc, r) => acc + r.count, 0);
  console.log(`\nTotal: ${total} linhas removidas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Erro:', err);
    prisma.$disconnect();
    process.exit(1);
  });

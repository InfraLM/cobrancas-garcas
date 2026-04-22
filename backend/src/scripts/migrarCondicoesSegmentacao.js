/**
 * Script de migracao pontual — normaliza condicoes de RegraSegmentacao no banco.
 *
 * Corrige bugs historicos em que o frontend escrevia `campoId` em vez de `campo`
 * e `valorFim` em vez de `valor2`. Tambem:
 * - Remove propriedade `id` de condicoes (nunca foi parte da interface)
 * - Renomeia `situacao_matricula` para `situacao_aluno`
 * - Remove condicoes com campos que nao existem em CAMPO_MAP (dead conditions)
 *
 * Rodar uma unica vez:
 *   cd backend && node --env-file=.env src/scripts/migrarCondicoesSegmentacao.js
 *
 * Safe para rodar mais de uma vez — e idempotente.
 */

import { prisma } from '../config/database.js';

// Campos validos conforme CAMPO_MAP em src/services/segmentacaoQueryBuilder.js
const CAMPOS_VALIDOS = new Set([
  'parcelas_atraso',
  'valor_inadimplente',
  'dias_atraso',
  'parcelas_pagas',
  'parcelas_a_vencer',
  'valor_pago',
  'situacao_aluno',
  'situacao_financeira',
  'ja_trancou',
  'turma',
  'frequencia',
  'aulas_assistidas',
  'dias_ultima_aula',
  'status_financeiro_pf',
  'recorrencia_ativa',
  'qtd_cadastros_recorrencia',
  'negativado',
  'tem_conversa_whatsapp',
  'tem_ligacao',
  'total_tickets_blip',
  'tickets_financeiro',
  'total_plantoes',
  'plantoes_realizados',
  'nao_enviar_cobranca',
  'bloquear_contato',
  'data_vencimento',
  'data_vencimento_mais_antiga',
]);

async function migrar() {
  const regras = await prisma.regraSegmentacao.findMany();
  console.log(`Encontradas ${regras.length} regras no banco.`);

  let regrasMigradas = 0;
  let totalCondRemovidas = 0;

  for (const regra of regras) {
    const cond = regra.condicoes;
    if (!Array.isArray(cond)) {
      console.log(`Regra "${regra.nome}" (${regra.id}) tem condicoes em formato invalido — pulando`);
      continue;
    }

    let mudou = false;

    // 1. Normaliza cada condicao
    const normalizadas = cond.map(c => {
      const nc = { ...c };
      // campoId -> campo
      if (nc.campoId && !nc.campo) {
        nc.campo = nc.campoId;
        delete nc.campoId;
        mudou = true;
      } else if (nc.campoId) {
        delete nc.campoId;
        mudou = true;
      }
      // valorFim -> valor2
      if (nc.valorFim !== undefined && nc.valor2 === undefined) {
        nc.valor2 = nc.valorFim;
        delete nc.valorFim;
        mudou = true;
      } else if (nc.valorFim !== undefined) {
        delete nc.valorFim;
        mudou = true;
      }
      // Remove id de condicao (nunca foi parte da interface)
      if (nc.id) {
        delete nc.id;
        mudou = true;
      }
      // Rename situacao_matricula -> situacao_aluno
      if (nc.campo === 'situacao_matricula') {
        nc.campo = 'situacao_aluno';
        // Valor 'Ativa' do sistema antigo -> 'ATIVO' do novo
        if (nc.valor === 'Ativa') nc.valor = ['ATIVO'];
        mudou = true;
      }
      return nc;
    });

    // 2. Remove condicoes com campo invalido
    const filtradas = normalizadas.filter(c => {
      const valido = c.campo && CAMPOS_VALIDOS.has(c.campo);
      if (!valido) {
        console.log(`  Regra "${regra.nome}": removendo condicao com campo invalido "${c.campo || '(vazio)'}"`);
      }
      return valido;
    });

    const removidas = normalizadas.length - filtradas.length;
    if (removidas > 0) {
      totalCondRemovidas += removidas;
      mudou = true;
    }

    if (mudou) {
      await prisma.regraSegmentacao.update({
        where: { id: regra.id },
        data: { condicoes: filtradas },
      });
      regrasMigradas++;
      console.log(`Migrada regra "${regra.nome}" (${regra.id}): ${cond.length} -> ${filtradas.length} condicoes`);
    }
  }

  console.log('\n--- Resumo ---');
  console.log(`Regras alteradas:       ${regrasMigradas}/${regras.length}`);
  console.log(`Condicoes removidas:    ${totalCondRemovidas}`);
  console.log(`Regras intactas:        ${regras.length - regrasMigradas}`);
}

migrar()
  .then(() => {
    console.log('\nMigracao concluida com sucesso.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nErro na migracao:', err);
    process.exit(1);
  });

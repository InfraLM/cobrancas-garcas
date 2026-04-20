import { useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../ui/Modal';
import { FileDown, Loader2, CheckSquare, Square } from 'lucide-react';
import { api } from '../../services/api';

interface ExportarSegmentacaoModalProps {
  aberto: boolean;
  onFechar: () => void;
  regraId: string;
  nomeRegra: string;
}

interface CategoriaConfig {
  id: string;
  label: string;
  campos: { id: string; label: string; campo: string }[];
}

const CATEGORIAS: CategoriaConfig[] = [
  {
    id: 'pessoal',
    label: 'Dados Pessoais',
    campos: [
      { id: 'nome', label: 'Nome Completo', campo: 'nome' },
      { id: 'cpf', label: 'CPF', campo: 'cpf' },
      { id: 'celular', label: 'Celular', campo: 'celular' },
      { id: 'email', label: 'E-mail', campo: 'email' },
      { id: 'telefone', label: 'Telefone', campo: 'telefone' },
      { id: 'sexo', label: 'Sexo', campo: 'sexo' },
      { id: 'dataNascimento', label: 'Data de Nascimento', campo: 'dataNascimento' },
      { id: 'estadoCivil', label: 'Estado Civil', campo: 'estadoCivil' },
      { id: 'endereco', label: 'Endereço', campo: 'endereco' },
      { id: 'bairro', label: 'Bairro', campo: 'bairro' },
      { id: 'cep', label: 'CEP', campo: 'cep' },
    ],
  },
  {
    id: 'academico',
    label: 'Dados Acadêmicos',
    campos: [
      { id: 'matricula', label: 'Matrícula', campo: 'matricula' },
      { id: 'turmaNome', label: 'Turma', campo: 'turmaNome' },
      { id: 'cursoNome', label: 'Curso', campo: 'cursoNome' },
      { id: 'situacao', label: 'Situação', campo: 'situacao' },
      { id: 'dataMatricula', label: 'Data Matrícula', campo: 'dataMatricula' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Dados Financeiros',
    campos: [
      { id: 'situacaoFinanceira', label: 'Situação Financeira', campo: 'situacaoFinanceira' },
      { id: 'valorDevedor', label: 'Valor Devedor', campo: 'valorDevedor' },
      { id: 'parcelasAtraso', label: 'Parcelas em Atraso', campo: 'parcelasAtraso' },
      { id: 'parcelasAVencer', label: 'Parcelas a Vencer', campo: 'parcelasAVencer' },
      { id: 'parcelasPagas', label: 'Parcelas Pagas', campo: 'parcelasPagas' },
      { id: 'valorEmAberto', label: 'Valor em Aberto', campo: 'valorEmAberto' },
      { id: 'valorPago', label: 'Valor Pago', campo: 'valorPago' },
    ],
  },
  {
    id: 'engajamento',
    label: 'Engajamento',
    campos: [
      { id: 'aulasAssistidas', label: 'Aulas Assistidas', campo: 'aulasAssistidas' },
      { id: 'frequencia', label: 'Frequência (%)', campo: 'frequencia' },
      { id: 'diasDesdeUltimaAula', label: 'Dias Desde Última Aula', campo: 'diasDesdeUltimaAula' },
      { id: 'tag', label: 'Tag', campo: 'tag' },
    ],
  },
  {
    id: 'plantoes',
    label: 'Plantões',
    campos: [
      { id: 'totalPlantoes', label: 'Total Plantões', campo: 'totalPlantoes' },
      { id: 'plantoesRealizados', label: 'Plantões Realizados', campo: 'plantoesRealizados' },
      { id: 'jaFoiPlantao', label: 'Já Foi no Plantão', campo: 'jaFoiPlantao' },
    ],
  },
  {
    id: 'recorrencia',
    label: 'Recorrência',
    campos: [
      { id: 'recorrenciaAtiva', label: 'Recorrência Ativa', campo: 'recorrenciaAtiva' },
      { id: 'totalCadastrosRecorrencia', label: 'Total Cadastros', campo: 'totalCadastrosRecorrencia' },
    ],
  },
  {
    id: 'flags',
    label: 'Serasa / Flags',
    campos: [
      { id: 'serasa', label: 'Negativado Serasa', campo: 'serasa' },
      { id: 'bloqueiocrm', label: 'Bloqueio CRM', campo: 'bloqueiocrm' },
      { id: 'naoCobrar', label: 'Não Cobrar', campo: 'naoCobrar' },
    ],
  },
  {
    id: 'suporte',
    label: 'Suporte',
    campos: [
      { id: 'totalTicketsBlip', label: 'Total Tickets Blip', campo: 'totalTicketsBlip' },
      { id: 'ticketsFinanceiro', label: 'Tickets Financeiro', campo: 'ticketsFinanceiro' },
    ],
  },
];

export default function ExportarSegmentacaoModal({ aberto, onFechar, regraId, nomeRegra }: ExportarSegmentacaoModalProps) {
  // Iniciar com todas as categorias basicas selecionadas
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<string>>(
    new Set(['pessoal', 'academico', 'financeiro'])
  );
  const [camposSelecionados, setCamposSelecionados] = useState<Set<string>>(() => {
    const inicial = new Set<string>();
    CATEGORIAS.filter(c => ['pessoal', 'academico', 'financeiro'].includes(c.id))
      .forEach(cat => cat.campos.forEach(campo => inicial.add(campo.id)));
    return inicial;
  });
  const [exportando, setExportando] = useState(false);
  const [agregacao, setAgregacao] = useState<'matricula' | 'titulo'>('matricula');

  function toggleCategoria(catId: string) {
    const cat = CATEGORIAS.find(c => c.id === catId)!;
    const todosMarcados = cat.campos.every(c => camposSelecionados.has(c.id));

    const novosCampos = new Set(camposSelecionados);
    const novasCategorias = new Set(categoriasSelecionadas);

    if (todosMarcados) {
      // Desmarcar todos da categoria
      cat.campos.forEach(c => novosCampos.delete(c.id));
      novasCategorias.delete(catId);
    } else {
      // Marcar todos da categoria
      cat.campos.forEach(c => novosCampos.add(c.id));
      novasCategorias.add(catId);
    }

    setCamposSelecionados(novosCampos);
    setCategoriasSelecionadas(novasCategorias);
  }

  function toggleCampo(campoId: string, catId: string) {
    const novosCampos = new Set(camposSelecionados);
    if (novosCampos.has(campoId)) {
      novosCampos.delete(campoId);
    } else {
      novosCampos.add(campoId);
    }
    setCamposSelecionados(novosCampos);

    // Atualizar categoria
    const cat = CATEGORIAS.find(c => c.id === catId)!;
    const novasCategorias = new Set(categoriasSelecionadas);
    if (cat.campos.some(c => novosCampos.has(c.id))) {
      novasCategorias.add(catId);
    } else {
      novasCategorias.delete(catId);
    }
    setCategoriasSelecionadas(novasCategorias);
  }

  async function handleExportar() {
    setExportando(true);
    try {
      // Buscar dados com categorias selecionadas
      const res = await api.post<{ data: any[] }>(`/segmentacoes/${regraId}/exportar`, {
        campos: Array.from(categoriasSelecionadas),
        agregacao,
      });

      const dados = res.data;
      if (!dados || dados.length === 0) {
        alert('Nenhum dado para exportar');
        return;
      }

      let xlsxData: Record<string, any>[];

      if (agregacao === 'titulo') {
        // Por titulo: colunas fixas
        xlsxData = dados.map((t: any) => ({
          'Nome': t.nome,
          'CPF': t.cpf,
          'Matrícula': t.matricula,
          'Turma': t.turma,
          'Parcela': t.parcela,
          'Tipo': t.tipoOrigem,
          'Vencimento': t.dataVencimento,
          'Valor': t.valor,
          'Multa': t.multa,
          'Juros': t.juro,
          'Desconto': t.desconto,
          'Recebido': t.valorRecebido,
          'Saldo': t.saldo,
          'Situação': t.situacao === 'AR' ? 'A Receber' : t.situacao === 'RE' ? 'Recebido' : t.situacao,
        }));
      } else {
        // Por matricula: colunas selecionadas
        const colunas = CATEGORIAS
          .flatMap(cat => cat.campos)
          .filter(c => camposSelecionados.has(c.id));

        xlsxData = dados.map((aluno: any) => {
          const row: Record<string, any> = {};
          for (const col of colunas) {
            row[col.label] = aluno[col.campo] ?? '';
          }
          return row;
        });
      }

      // Gerar planilha
      const ws = XLSX.utils.json_to_sheet(xlsxData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Alunos');

      // Download
      const nomeArquivo = `${nomeRegra.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      onFechar();
    } catch (err: any) {
      alert(`Erro ao exportar: ${err.message}`);
    } finally {
      setExportando(false);
    }
  }

  const totalCampos = camposSelecionados.size;

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Exportar Planilha XLSX" largura="max-w-xl">
      <div className="space-y-5">
        <p className="text-[0.8125rem] text-on-surface-variant">
          Selecione os campos que deseja incluir na exportação da regra <strong>{nomeRegra}</strong>.
        </p>

        {/* Toggle agregacao */}
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-on-surface-variant">Agregar por:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setAgregacao('matricula')}
              className={`px-4 py-1.5 text-[0.75rem] font-medium transition-colors ${agregacao === 'matricula' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-gray-50'}`}>
              Matrícula (1 linha/aluno)
            </button>
            <button onClick={() => setAgregacao('titulo')}
              className={`px-4 py-1.5 text-[0.75rem] font-medium transition-colors ${agregacao === 'titulo' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-gray-50'}`}>
              Título (1 linha/parcela)
            </button>
          </div>
        </div>

        <p className="hidden">
        </p>

        {/* Categorias com checkboxes */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto">
          {CATEGORIAS.map(cat => {
            const todosMarcados = cat.campos.every(c => camposSelecionados.has(c.id));
            const algunsMarcados = cat.campos.some(c => camposSelecionados.has(c.id));

            return (
              <div key={cat.id}>
                {/* Header da categoria */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.8125rem] font-bold text-on-surface">{cat.label}</span>
                  <button onClick={() => toggleCategoria(cat.id)}
                    className="flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline">
                    {todosMarcados ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-on-surface-variant/30" />}
                    Todos
                  </button>
                </div>

                {/* Campos */}
                <div className="grid grid-cols-2 gap-1.5">
                  {cat.campos.map(campo => {
                    const marcado = camposSelecionados.has(campo.id);
                    return (
                      <button key={campo.id} onClick={() => toggleCampo(campo.id, cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[0.8125rem] text-left transition-colors ${
                          marcado ? 'bg-primary/5 text-on-surface' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                        }`}>
                        {marcado ? <CheckSquare size={14} className="text-primary shrink-0" /> : <Square size={14} className="text-on-surface-variant/30 shrink-0" />}
                        {campo.label}
                      </button>
                    );
                  })}
                </div>

                {/* Separador */}
                <div className="border-b border-gray-100 mt-3" />
              </div>
            );
          })}
        </div>

        {/* Botoes */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[0.75rem] text-on-surface-variant">{totalCampos} campos selecionados</span>
          <div className="flex gap-3">
            <button onClick={onFechar}
              className="px-5 py-2.5 rounded-xl text-[0.8125rem] font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
              Cancelar
            </button>
            <button onClick={handleExportar} disabled={totalCampos === 0 || exportando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
              {exportando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {exportando ? 'Exportando...' : 'Exportar XLSX'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

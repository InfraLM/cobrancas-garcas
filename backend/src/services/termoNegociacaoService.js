// Gera PDF do Termo de Confissao de Divida a partir do template HTML
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'termoNegociacao.html');

// -----------------------------------------------
// Valor por extenso (ate milhoes)
// -----------------------------------------------
function valorPorExtenso(valor) {
  if (valor === 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function grupoExtenso(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    const parts = [];
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) parts.push(centenas[c]);

    if (d === 1) {
      parts.push(especiais[u]);
    } else {
      if (d > 1) parts.push(dezenas[d]);
      if (u > 0) parts.push(unidades[u]);
    }

    return parts.join(' e ');
  }

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const partes = [];

  const milhares = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;

  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : `${grupoExtenso(milhares)} mil`);
  }
  if (resto > 0) {
    partes.push(grupoExtenso(resto));
  }

  let resultado = partes.join(' e ');
  resultado += inteiro === 1 ? ' real' : ' reais';

  if (centavos > 0) {
    resultado += ` e ${grupoExtenso(centavos)} centavo${centavos === 1 ? '' : 's'}`;
  }

  return resultado;
}

// -----------------------------------------------
// Formatar moeda BRL
// -----------------------------------------------
function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// -----------------------------------------------
// Formatar data BR
// -----------------------------------------------
function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

// -----------------------------------------------
// Forma de pagamento label
// -----------------------------------------------
const FORMA_LABEL = {
  PIX: 'PIX',
  BOLETO: 'Boleto Bancário',
  CREDIT_CARD: 'Cartão de Crédito',
};

// -----------------------------------------------
// Gerar HTML preenchido do termo
// -----------------------------------------------
export function gerarHtmlTermo(acordo) {
  let html = readFileSync(TEMPLATE_PATH, 'utf-8');

  // Dados do aluno
  html = html.replace(/\{\{nomeAluno\}\}/g, acordo.pessoaNome);
  html = html.replace(/\{\{cpfAluno\}\}/g, acordo.pessoaCpf);
  html = html.replace(/\{\{matriculaAluno\}\}/g, acordo.matricula || '—');
  html = html.replace(/\{\{celularAluno\}\}/g, acordo.celularAluno || '—');
  html = html.replace(/\{\{emailAluno\}\}/g, acordo.emailAluno || '—');

  // Valores
  const saldoDevedor = Number(acordo.valorSaldoDevedor);
  const valorAcordo = Number(acordo.valorAcordo);
  const desconto = saldoDevedor - valorAcordo;

  html = html.replace(/\{\{valorSaldoDevedor\}\}/g, formatarMoeda(saldoDevedor));
  html = html.replace(/\{\{valorSaldoDevedorExtenso\}\}/g, valorPorExtenso(saldoDevedor));
  html = html.replace(/\{\{valorAcordo\}\}/g, formatarMoeda(valorAcordo));
  html = html.replace(/\{\{valorAcordoExtenso\}\}/g, valorPorExtenso(valorAcordo));

  // Texto desconto: vazio se nao houver, com info se houver
  if (desconto > 0.01) {
    const pct = ((desconto / saldoDevedor) * 100).toFixed(1);
    html = html.replace('{{textoDesconto}}', `, representando desconto de ${pct}% sobre o saldo devedor`);
  } else {
    html = html.replace('{{textoDesconto}}', '');
  }

  // Tabela parcelas originais
  let linhasOriginais = '';
  let totalNominal = 0, totalMultaJuros = 0, totalAtualizado = 0;

  for (const p of acordo.parcelasOriginais) {
    const nominal = Number(p.valor);
    const mj = Number(p.multa || 0) + Number(p.juro || 0);
    const atualizado = nominal + mj - Number(p.descontos || 0) - Number(p.valorRecebido || 0);
    totalNominal += nominal;
    totalMultaJuros += mj;
    totalAtualizado += atualizado;

    linhasOriginais += `<tr>
      <td>${p.parcela || '—'}</td>
      <td>${formatarData(p.dataVencimento)}</td>
      <td class="valor">${formatarMoeda(nominal)}</td>
      <td class="valor">${formatarMoeda(mj)}</td>
      <td class="valor">${formatarMoeda(atualizado)}</td>
    </tr>`;
  }

  html = html.replace('{{linhasParcelasOriginais}}', linhasOriginais);
  html = html.replace('{{totalNominal}}', formatarMoeda(totalNominal));
  html = html.replace('{{totalMultaJuros}}', formatarMoeda(totalMultaJuros));
  html = html.replace('{{totalAtualizado}}', formatarMoeda(totalAtualizado));

  // Tabela pagamentos
  let linhasPagamentos = '';
  for (const pg of acordo.pagamentos) {
    const forma = FORMA_LABEL[pg.formaPagamento] || pg.formaPagamento;
    const label = pg.parcelas > 1 ? `${forma} (${pg.parcelas}x)` : forma;
    linhasPagamentos += `<tr>
      <td>${pg.numeroPagamento}/${acordo.pagamentos.length}</td>
      <td>${formatarData(pg.dataVencimento)}</td>
      <td>${label}</td>
      <td class="valor">${formatarMoeda(pg.valor)}</td>
    </tr>`;
  }
  html = html.replace('{{linhasPagamentos}}', linhasPagamentos);

  // Clausula recorrencia (condicional)
  const comRecorrencia = acordo.vincularRecorrencia === true;
  if (comRecorrencia) {
    html = html.replace('{{clausulaRecorrencia}}', `
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 5ª - VINCULAÇÃO À RECORRÊNCIA</div>
        <div class="recorrencia-box">
          <div class="titulo">Condição especial</div>
          <p>
            O(A) DEVEDOR(A) declara ciência de que a baixa integral deste acordo no sistema acadêmico da CREDORA está
            condicionada ao cumprimento cumulativo de duas condições: <strong>(i)</strong> pagamento integral de todas as parcelas
            deste acordo; e <strong>(ii)</strong> cadastro de cartão de crédito para pagamento recorrente das mensalidades vincendas
            no sistema acadêmico. O descumprimento de qualquer uma dessas condições impedirá a regularização acadêmica do(a) DEVEDOR(A).
          </p>
        </div>
      </div>
    `);
    html = html.replace(/\{\{numClausulaTitulo\}\}/g, '6');
    html = html.replace(/\{\{numClausulaDigital\}\}/g, '7');
    html = html.replace(/\{\{numClausulaForo\}\}/g, '8');
  } else {
    html = html.replace('{{clausulaRecorrencia}}', '');
    html = html.replace(/\{\{numClausulaTitulo\}\}/g, '5');
    html = html.replace(/\{\{numClausulaDigital\}\}/g, '6');
    html = html.replace(/\{\{numClausulaForo\}\}/g, '7');
  }

  // Agente e data
  html = html.replace('{{nomeAgente}}', acordo.criadoPorNome || '—');
  html = html.replace('{{dataAcordo}}', formatarData(acordo.criadoEm || new Date()));

  return html;
}

// -----------------------------------------------
// Gerar PDF Buffer a partir do HTML
// -----------------------------------------------
export async function gerarPdfTermo(acordo) {
  const html = gerarHtmlTermo(acordo);

  const isProduction = process.env.NODE_ENV === 'production';

  const browser = await puppeteer.launch({
    headless: true,
    // Producao (Railway/container Linux): usa o Chromium empacotado via @sparticuz/chromium.
    // Dev (Windows/macOS/Linux com Chrome system): usa o binario do sistema via CHROME_PATH.
    executablePath: isProduction
      ? await chromium.executablePath()
      : process.env.CHROME_PATH || (
        process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome'
      ),
    args: isProduction
      ? chromium.args
      : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// -----------------------------------------------
// Gerar PDF como base64 (para ClickSign)
// -----------------------------------------------
export async function gerarPdfBase64(acordo) {
  const buffer = await gerarPdfTermo(acordo);
  return Buffer.from(buffer).toString('base64');
}

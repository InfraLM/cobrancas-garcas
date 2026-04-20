import { prisma } from '../config/database.js';
import { randomUUID } from 'crypto';

const BLIP_URL = process.env.BLIP_API_URL;
const BLIP_KEY = process.env.BLIP_AUTH_KEY;
const PAGE_SIZE = 100;
const DELAY_MS = 250; // abaixo do limite de 48 req/s

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// -----------------------------------------------
// Sanitizacao de CPF e telefone
// -----------------------------------------------

function sanitizarCpf(raw) {
  if (!raw) return null;
  // Tenta encontrar 11 digitos consecutivos no texto original (sem remover nada)
  const match = raw.replace(/[.\-\/]/g, '').match(/\d{11}/);
  if (!match) return null;
  const d = match[0];
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

function sanitizarTelefone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  // Remove prefixo 55 (codigo pais Brasil)
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  }
  return null;
}

async function blipCommand(to, uri) {
  const res = await fetch(BLIP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${BLIP_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: randomUUID(),
      to,
      method: 'get',
      uri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Blip API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// -----------------------------------------------
// 1. Buscar todos os contatos (paginado)
// -----------------------------------------------
async function fetchAllContacts() {
  const contacts = [];
  let skip = 0;
  let total = Infinity;

  console.log('Buscando contatos...');

  while (skip < total) {
    const data = await blipCommand(
      'postmaster@crm.msging.net',
      `/contacts?$skip=${skip}&$take=${PAGE_SIZE}`
    );

    const resource = data.resource;
    total = resource.total;
    const items = resource.items || [];
    contacts.push(...items);

    console.log(`  ${contacts.length}/${total} contatos`);
    skip += PAGE_SIZE;

    if (skip < total) await sleep(DELAY_MS);
  }

  return contacts;
}

// -----------------------------------------------
// 2. Buscar historico de tickets (paginado)
// -----------------------------------------------
async function fetchAllTickets() {
  const tickets = [];
  let skip = 0;
  let total = Infinity;

  const filter = encodeURIComponent("storageDate ge datetimeoffset'2025-01-01T00:00:00.000Z'");

  console.log('Buscando tickets (desde 01/01/2025)...');

  while (skip < total) {
    const data = await blipCommand(
      'postmaster@desk.msging.net',
      `/tickets/history/metadata?$skip=${skip}&$take=${PAGE_SIZE}&$filter=${filter}`
    );

    const resource = data.resource;
    total = resource.total;
    const items = resource.items || [];
    tickets.push(...items);

    console.log(`  ${tickets.length}/${total} tickets`);
    skip += PAGE_SIZE;

    if (skip < total) await sleep(DELAY_MS);
  }

  return tickets;
}

// -----------------------------------------------
// 3. Salvar no banco
// -----------------------------------------------
async function main() {
  console.log('=== Carga historica Blip ===\n');

  // Buscar dados da API
  const rawContacts = await fetchAllContacts();
  console.log(`\n${rawContacts.length} contatos recebidos da API.`);

  await sleep(DELAY_MS);

  const rawTickets = await fetchAllTickets();
  console.log(`\n${rawTickets.length} tickets recebidos da API.`);

  // Sanitizar contatos
  const contacts = rawContacts.map(c => {
    const cpfRaw = c.extras?.cpfCnpj?.trim() || null;
    const phoneRaw = c.phoneNumber?.trim() || null;
    return {
      identity:            c.identity?.trim() || '',
      name:                c.name?.trim() || null,
      phoneNumber:         phoneRaw,
      cpf:                 cpfRaw,
      cpf_sanitizado:      sanitizarCpf(cpfRaw),
      telefone_sanitizado: sanitizarTelefone(phoneRaw),
    };
  }).filter(c => c.identity);

  // Sanitizar tickets
  const tickets = rawTickets.map(t => ({
    id:               String(t.id).trim(),
    sequentialId:     t.sequentialId != null ? parseInt(t.sequentialId, 10) : null,
    customerIdentity: t.customerIdentity?.trim() || null,
    agentIdentity:    t.agentIdentity?.trim() || null,
    status:           t.status?.trim() || null,
    storageDate:      t.storageDate?.trim() || null,
    team:             t.team?.trim() || null,
    closed:           t.closed != null ? (t.closed ? 1 : 0) : null,
    priority:         t.priority != null ? parseInt(t.priority, 10) : null,
  })).filter(t => t.id);

  console.log(`\nSalvando ${contacts.length} contatos e ${tickets.length} tickets...`);

  const BATCH = 200;

  await prisma.$transaction(async (tx) => {
    // Limpar e inserir contatos
    await tx.blipContact.deleteMany();
    for (let i = 0; i < contacts.length; i += BATCH) {
      await tx.blipContact.createMany({ data: contacts.slice(i, i + BATCH) });
    }

    // Limpar e inserir tickets
    await tx.blipTicket.deleteMany();
    for (let i = 0; i < tickets.length; i += BATCH) {
      await tx.blipTicket.createMany({ data: tickets.slice(i, i + BATCH) });
    }
  }, { timeout: 60_000 });

  // Resumo
  const cpfsComCpf = contacts.filter(c => c.cpf).length;
  const cpfsSanitizados = contacts.filter(c => c.cpf_sanitizado).length;
  const telsSanitizados = contacts.filter(c => c.telefone_sanitizado).length;
  const teams = {};
  for (const t of tickets) {
    teams[t.team || '(sem equipe)'] = (teams[t.team || '(sem equipe)'] || 0) + 1;
  }

  console.log(`\nContatos: ${contacts.length}`);
  console.log(`  CPF original preenchido: ${cpfsComCpf}`);
  console.log(`  CPF sanitizado (pronto p/ JOIN): ${cpfsSanitizados}`);
  console.log(`  Telefone sanitizado: ${telsSanitizados}`);
  console.log(`Tickets: ${tickets.length}`);
  console.log('Tickets por equipe:');
  for (const [team, count] of Object.entries(teams).sort()) {
    console.log(`  ${team}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  prisma.$disconnect();
  process.exit(1);
});

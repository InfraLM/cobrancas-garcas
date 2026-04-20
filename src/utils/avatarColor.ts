const CORES_AVATAR = [
  { bg: '#E8394220', text: '#C62828' },   // Vermelho
  { bg: '#7C4DFF20', text: '#5E35B1' },   // Roxo
  { bg: '#2979FF20', text: '#1565C0' },   // Azul
  { bg: '#00BFA520', text: '#00897B' },   // Teal
  { bg: '#00C85320', text: '#2E7D32' },   // Verde
  { bg: '#FF6D0020', text: '#E65100' },   // Laranja
  { bg: '#F5006420', text: '#AD1457' },   // Rosa
  { bg: '#6D4C4120', text: '#4E342E' },   // Marrom
  { bg: '#546E7A20', text: '#37474F' },   // Cinza azulado
  { bg: '#FFB30020', text: '#F57F17' },   // Amarelo
];

function hashNome(nome: string): number {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getAvatarColor(nome: string) {
  const index = hashNome(nome) % CORES_AVATAR.length;
  return CORES_AVATAR[index];
}

export function getIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

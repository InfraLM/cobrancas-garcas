# Frontend - React + TypeScript

Este diretorio contem todo o codigo frontend da aplicacao.

## Convencoes de Nomenclatura

| Tipo | Padrao | Exemplo | Pasta |
|------|--------|---------|-------|
| Pagina | `<Nome>Page.tsx` | `HomePage.tsx`, `LoginPage.tsx` | `pages/` |
| Componente | `<Nome>.tsx` | `Button.tsx`, `UserCard.tsx` | `components/` |
| Hook | `use<Nome>.ts` | `useApi.ts`, `useAuth.ts` | `hooks/` |
| Service | `<nome>.ts` | `api.ts`, `auth.ts` | `services/` |
| Context | `<Nome>Context.tsx` | `AuthContext.tsx` | `contexts/` |
| Types | `index.ts` ou `<nome>.ts` | `index.ts` | `types/` |
| Utility | `<nome>.ts` | `formatters.ts` | `utils/` |

## Regras

- **Um componente por arquivo**. O nome do arquivo deve ser igual ao nome do componente
- **PascalCase** para componentes e paginas, **camelCase** para hooks, services e utils
- **TODA chamada a API deve passar pelo `services/api.ts`**. NUNCA use `fetch` ou `axios` diretamente em componentes ou paginas
- **Sempre trate estados de loading e error** em paginas que buscam dados
- Use o hook `useApi` de `/hooks/useApi.ts` para GETs simples
- Para a URL da API, use `import.meta.env.VITE_API_URL` ou o default `/api`

## Estrutura de uma Pagina Tipica

```tsx
import { useApi } from '../hooks/useApi';
import type { MeuTipo } from '../types';

export default function MinhaPage() {
  const { data, loading, error } = useApi<MeuTipo[]>('/minha-rota');

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>Erro: {error}</p>;

  return (
    <div>
      <h1>Minha Pagina</h1>
      {/* Renderizar data aqui */}
    </div>
  );
}
```

## Estrutura de um Componente Tipico

```tsx
interface MeuComponenteProps {
  titulo: string;
  onClick: () => void;
}

export default function MeuComponente({ titulo, onClick }: MeuComponenteProps) {
  return <button onClick={onClick}>{titulo}</button>;
}
```

## Roteamento

As rotas ficam em `/src/App.tsx` usando react-router-dom:
```tsx
<Route path="/caminho" element={<NomePage />} />
```

## Contextos

Use contextos para estado global (auth, tema, etc). O padrao esta em `contexts/AuthContext.tsx`.
Sempre crie o Provider e o hook de acesso juntos no mesmo arquivo.

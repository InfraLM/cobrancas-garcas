# Modelo Padrao - Template Empresarial

Template padrao para desenvolvimento de aplicacoes internas com Claude Code.

## Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Express 5 + Prisma ORM
- **Banco local**: SQLite (sem instalacao necessaria)
- **Banco producao**: PostgreSQL
- **Deploy**: Vercel

## Como comecar

```bash
# 1. Instalar dependencias (frontend + backend)
npm install

# 2. Criar o banco de dados local
cd backend
npx prisma migrate dev --name init

# 3. Voltar para a raiz e iniciar tudo
cd ..
npm run dev:all
```

O frontend abre em `http://localhost:5173` e o backend em `http://localhost:3001`.

## Comandos uteis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia apenas o frontend |
| `npm run dev:backend` | Inicia apenas o backend |
| `npm run dev:all` | Inicia frontend + backend |
| `cd backend && npx prisma studio` | Abre visual do banco |
| `cd backend && npx prisma migrate dev --name descricao` | Cria migration |

## Estrutura do Projeto

```
src/                    # Frontend React
  pages/                # Paginas da aplicacao
  components/           # Componentes reutilizaveis
  hooks/                # Custom hooks
  services/             # Comunicacao com API
  contexts/             # React Contexts
  types/                # Tipos TypeScript
  utils/                # Funcoes utilitarias

backend/                # Backend Express
  src/
    routes/             # Rotas da API
    controllers/        # Logica de negocios
    middleware/          # Middlewares
    config/             # Configuracoes (banco)
    utils/              # Utilitarios
  prisma/
    schema.prisma       # Schema do banco
```

## Visualizar o banco de dados no VS Code

O banco de dados local e um arquivo SQLite (`backend/prisma/dev.db`). Para visualizar e editar os dados diretamente no VS Code:

### Opcao 1: Extensao SQLite Viewer (mais simples)

1. Abra o VS Code
2. Va em **Extensoes** (icone de quadradinhos na barra lateral ou `Ctrl+Shift+X`)
3. Pesquise por **"SQLite Viewer"** (autor: Florian Klampfer)
4. Clique em **Instalar**
5. Depois de instalar, clique no arquivo `backend/prisma/dev.db` no explorador de arquivos
6. O VS Code abre uma visualizacao com todas as tabelas e dados

### Opcao 2: Extensao SQLite Explorer (mais completa)

1. Abra o VS Code
2. Va em **Extensoes** (`Ctrl+Shift+X`)
3. Pesquise por **"SQLite"** (autor: alexcvzz)
4. Clique em **Instalar**
5. Pressione `Ctrl+Shift+P` e digite **"SQLite: Open Database"**
6. Selecione o arquivo `backend/prisma/dev.db`
7. Na barra lateral aparece a secao **SQLITE EXPLORER** com todas as tabelas
8. Clique com botao direito em uma tabela e selecione **"Show Table"** para ver os dados

### Opcao 3: Prisma Studio (sem instalar nada)

Se preferir nao instalar extensoes, o Prisma ja tem um visualizador web:

```bash
cd backend
npx prisma studio
```

Isso abre `http://localhost:5555` no navegador com uma interface visual para ver e editar os dados do banco.

## Para o Claude Code

Os arquivos `CLAUDE.md` espalhados no projeto guiam o Claude Code a seguir os padroes corretos. Consulte:
- `CLAUDE.md` (raiz) - Visao geral e regras
- `src/CLAUDE.md` - Padroes frontend
- `backend/CLAUDE.md` - Padroes backend

# Velobet

Reconstrução do VeloApostas — sistema de apostas de ciclismo entre amigos (Next.js 15 + Supabase), com o novo design system editorial (fundo claro, cards pretos de destaque, dourado como accent, serif itálico + monoespaçada).

Este projeto usa o **mesmo Supabase** do projeto original (`cycling-bets`) — não é preciso recriar o schema nem os utilizadores. Ver `supabase/schema.sql` para referência do schema existente.

## Design system

A pasta `design-system/` contém a fonte de verdade visual:
- `design-system.md` — especificação completa (cor, tipografia, espaçamento, componentes, acessibilidade)
- `tokens.css` — CSS custom properties + classes de componentes (já aplicado em `src/app/globals.css`)
- `style-guide.html` — guia visual interativo
- `tailwind.tokens.snippet.ts` — referência da extensão do Tailwind (já aplicada em `tailwind.config.ts`)

## Setup

```bash
npm install
cp .env.example .env.local
# preencher .env.local com as credenciais do MESMO projeto Supabase do VeloApostas
npm run dev
```

## Páginas construídas

- `/auth/login` — login + registo (toggle), com botão de Google (placeholder até se configurar o provider no Supabase)
- `/hoje` — dashboard do dia: próxima etapa em destaque, contagem decrescente, classificação Top 20 (estado vazio até a etapa finalizar)

## Próximos passos

- Ligar `/hoje` aos dados reais das tabelas `provas`/`etapas`/`apostas`
- Configurar o provider Google OAuth no Supabase (Authentication → Providers)
- Construir as restantes páginas: Próximas, Classificação, Histórico, Eu

# Design System — VeloApostas (redesign editorial)

Direção escolhida: **editorial premium** — fundo claro/creme, cards de destaque em preto, acento dourado, títulos em serif itálico, dados em monoespaçada. Ponto de partida: mockup de referência (Tour · 2026 / "Olá, Nuno.").

Este documento é a fonte de verdade para a próxima fase (gerar a webapp). Tudo o que aqui está definido deve ser respeitado sem reinterpretação livre nessa fase.

---

## 1. Princípios

1. **Editorial, não corporativo.** Serif itálico nos momentos de destaque (saudação, nome da prova) — dá tom de revista desportiva, não de dashboard SaaS.
2. **Preto como cor de destaque, não de fundo.** O preto é reservado para o cartão "hero" da etapa/prova em foco e para elementos de alta prioridade. O resto da app mantém-se claro.
3. **Dourado é sinal de ação e urgência.** Usado em CTAs, contadores, e no primeiro lugar do ranking. Não é decorativo — se algo é dourado, é porque importa agora.
4. **Números são monoespaçados sempre.** Pontos, distâncias, tempos, deadlines — qualquer valor numérico usa `mono` com `tabular-nums`, para alinhar e não "dançar".
5. **Labels em maiúsculas trackeadas** (mono, letter-spacing largo) identificam categorias/metadados (datas, unidades, secções) — nunca conteúdo principal.

---

## 2. Cor

### 2.1 Base (fundo claro)

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F6F4EE` | Fundo geral da app |
| `--surface` | `#FFFFFF` | Cards claros, inputs |
| `--surface-2` | `#FCFBF7` | Linhas alternadas de tabela, hover subtil |
| `--surface-3` | `#EFEAE0` | Backgrounds de badges neutros, chips inativos |
| `--border` | `#E7E2D6` | Contornos de cards claros |
| `--border-hi` | `#DED7C6` | Contornos com mais contraste (botão secundário) |

### 2.2 Texto (sobre fundo claro)

| Token | Hex | Contraste vs `--bg` | Uso |
|---|---|---|---|
| `--text` | `#15130E` | 16.9:1 | Texto principal |
| `--text-dim` | `#6B6455` | 5.3:1 | Texto secundário, **eyebrows/labels que têm de ser lidos** |
| `--text-sub` | `#8C8573` | 3.3:1 | **Só** placeholders e estados disabled — nunca conteúdo relevante |
| `--text-muted` | `#B8B0A0` | — | Puramente decorativo (ex. ícone desativado), nunca texto |

### 2.3 Preto editorial (cards hero)

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#16140F` | Fundo do card hero (etapa em destaque, momentos-chave) |
| `--ink-2` | `#211D15` | Variante ligeiramente mais clara (divisores/hover dentro do card preto) |
| `--on-ink` | `#FFFFFF` | Texto principal sobre `--ink` (18.4:1) |
| `--on-ink-dim` | `rgba(255,255,255,0.56)` | Texto secundário sobre `--ink` (6.4:1) |
| `--on-ink-sub` | `rgba(255,255,255,0.45)` | Labels/legendas sobre `--ink` (4.5:1 — mínimo AA) |
| `--on-ink-border` | `rgba(255,255,255,0.10)` | Divisores dentro do card preto |

### 2.4 Dourado (accent)

| Token | Hex | Uso |
|---|---|---|
| `--gold` | `#F3C13A` | CTA primário, contador em urgência, destaque nº 1 |
| `--gold-strong` | `#E0A916` | Hover/pressed do CTA |
| `--gold-soft` | `rgba(243,193,58,0.14)` | Fundo de badges/chips dourados |
| `--gold-ink` | `#2B2004` | Texto sobre fundo `--gold` (contraste AA) |

Regra: **nunca** usar dourado como cor de texto sobre fundo claro (`--bg`/`--surface`) para texto de leitura — falha contraste. Dourado-texto só existe sobre `--ink` (preto) ou como fundo (`--gold` com `--gold-ink` por cima).

### 2.5 Semântica (estados)

Cada cor semântica tem duas variantes: a cor de **identidade** (dots, ícones, gráficos) e a cor de **texto de badge** (mais escura, para garantir AA sobre o fundo tintado do próprio badge).

| Estado | Identidade | Texto de badge | Contraste (texto vs fundo do badge) |
|---|---|---|---|
| Aberta | `--green` `#16A34A` | `--green-text` `#146633` | 5.8:1 |
| Fechada | `--amber` `#B8860B` | `--amber-text` `#734C06` | 6.2:1 |
| Brevemente (etapa ainda não começou) | `--blue` `#2563EB` | `--blue-text` `#1E40AF` | 7.0:1 |
| Erro/encerrado | `--red` `#D0452A` | usar o próprio `--red` (uso raro em badge) | — |

Nota: `--blue` deixa de ser "uso raro" — passa a ser o estado oficial de **Brevemente** nos badges de etapa (Brevemente → A decorrer → Finalizada).

### 2.6 Medalhas (ranking)

| Posição | Hex | Contraste vs `--bg` |
|---|---|---|
| 1º | `#C79A2E` (dourado, distinto do `--gold` de CTA) | 2.4:1 — usar sempre em peso 800/tamanho grande, nunca como texto corrido |
| 2º | `#6E7480` (prata escurecida para leitura) | 4.3:1 |
| 3º | `#B5651D` | 3.9:1 — idem 1º, só em números grandes/bold |

---

## 3. Tipografia

Três famílias, cada uma com um papel fixo — nunca trocar entre si.

| Família | Papel | Peso(s) |
|---|---|---|
| **Fraunces** (serif, itálico) | Títulos de destaque: saudação, nome da prova/etapa, momentos editoriais | 400 italic (default), 500 italic (ênfase) |
| **Archivo** (sans, já em uso) | UI geral: corpo de texto, botões, navegação, formulários | 500 (corpo), 600–700 (botões/labels de UI) |
| **JetBrains Mono** (já em uso) | Todos os números e labels de metadados (datas, unidades, contadores, pontos) | 500 (labels), 600–700 (valores) |

Import (Google Fonts):
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

### 2.7 Escala tipográfica

| Estilo | Família | Tamanho / line-height | Peso | Exemplo de uso |
|---|---|---|---|---|
| `display-2xl` | Fraunces italic | 40px / 1.05 | 400 | "Olá, Nuno." |
| `display-xl` | Fraunces italic | 30px / 1.1 | 400–500 | "Alpe d'Huez" (nome da etapa) |
| `display-lg` | Fraunces italic | 22px / 1.15 | 500 | Títulos de secção editoriais |
| `body-lg` | Archivo | 16px / 1.5 | 500 | Texto de introdução |
| `body` | Archivo | 14px / 1.5 | 500 | Corpo de texto geral |
| `body-sm` | Archivo | 13px / 1.4 | 500 | Texto secundário, ajuda |
| `button` | Archivo | 14px / 1 | 700 | CTAs, botões |
| `nav-label` | Archivo | 11px / 1 | 600 | Labels da bottom nav |
| `eyebrow` | JetBrains Mono | 11px / 1.3 | 600, uppercase, tracking 0.14em | "QUINTA, 23 JULHO", "DIST." |
| `stat-lg` | JetBrains Mono | 30px / 1 | 700, tabular-nums | "180", "02:14:07" |
| `stat-md` | JetBrains Mono | 18px / 1.1 | 700, tabular-nums | Valores secundários |
| `stat-unit` | JetBrains Mono | 12px / 1 | 500 | "km", "m", "pts" |

---

## 4. Espaçamento & Radius

Escala base 4px: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 8px | Chips pequenos, inputs compactos |
| `--radius-md` | 14px | Inputs, botão secundário |
| `--radius-lg` | 20px | Cards claros (ex. "camisola") |
| `--radius-xl` | 28px | Card hero preto |
| `--radius-pill` | 999px | Badges de estado, avatar, segmented control |

Padding padrão de card: 20–24px. Gap padrão entre elementos de um card: 16px.

---

## 5. Elevação

Estilo editorial = quase plano. Evitar sombras pesadas.

- Cards claros: apenas `1px solid var(--border)`, sem sombra (ou sombra quase invisível: `0 1px 2px rgba(0,0,0,0.04)`).
- Card hero preto: sem borda, eleva-se por contraste de cor. Sombra opcional só quando sobreposto a outro conteúdo: `0 12px 32px rgba(0,0,0,0.18)`.
- Nunca usar sombras coloridas ou glow no dourado.

---

## 6. Componentes

### 6.1 Eyebrow label
Texto mono, uppercase, tracking largo, cor `--text-sub` (sobre claro) ou `--on-ink-sub` (sobre preto). Ex.: `QUINTA, 23 JULHO · 11:15`, `PRÓXIMA ETAPA · QUINTA`, `DIST.`, `DEADLINE`.

### 6.2 Título de saudação / editorial
Fraunces itálico, `display-2xl` ou `display-xl`. O nome da pessoa (ou elemento a destacar) pode ganhar leve ênfase (peso 500) dentro da frase, o resto fica em 400.

### 6.3 Botão primário (CTA)
- Fundo `--gold`, texto `--gold-ink`, peso 700, `radius-lg` (20px), padding 16px 20px.
- Ícone seta `→` à direita, alinhado.
- Hover/pressed: `--gold-strong`.
- Disabled: opacidade 0.4.
- Usado sempre que a ação é a prioridade nº1 do ecrã (ex. "Escolher ciclistas").

### 6.4 Botão secundário
Transparente, borda `--border-hi`, texto `--text`, `radius-md`. Para ações não-prioritárias.

### 6.5 Badge de estado (pill)
`radius-pill`, mono uppercase 10–11px, peso 600, com um "dot" indicador à esquerda.
- **Aberta**: fundo `rgba(22,163,74,.10)`, texto `--green-text`.
- **Fechada**: fundo `rgba(184,134,11,.12)`, texto `--amber-text`.
- **Finalizada**: fundo `--surface-3`, texto `--text-dim`.
- **A decorrer** (sobre card preto): fundo `--gold-soft` adaptado a preto (`rgba(243,193,58,.16)`), texto `--gold`.
- **Brevemente** (etapa ainda não começou): fundo `rgba(37,99,235,.10)`, texto `--blue-text`. Usado no card hero antes de "A decorrer" (ciclo: Brevemente → A decorrer → Finalizada).

Nota: o texto do badge usa sempre a variante `-text` (mais escura), nunca a cor de identidade pura — ver 2.5.

### 6.6 Card Hero (preto)
O componente central da direção visual. Estrutura:
1. Eyebrow (`--on-ink-sub`) + badge de estado alinhado à direita.
2. Título Fraunces itálico (`--on-ink`), `display-xl`.
3. Linha divisória (`--on-ink-border`).
4. Fila de stat blocks (ver 6.7), separados por divisores verticais finos.
5. Linha divisória.
6. Fila deadline + contador (ver 6.8).
7. CTA primário full-width.

Padding 24px, `radius-xl` (28px).

### 6.7 Stat block
Par label/valor, empilhado verticalmente:
- Label: `eyebrow`, cor dim/sub consoante fundo.
- Valor: `stat-lg` ou `stat-md`, cor `--on-ink` ou `--text`.
- Unidade (opcional): `stat-unit`, ao lado do valor, cor dim.

Usado dentro do card hero (DIST./ASC./ORDEM) e em cards de resumo (pontos, posição).

### 6.8 Contador (countdown)
Label eyebrow ("RESTAM") por cima de valor mono `stat-lg`, cor `--gold` quando resta pouco tempo (urgência), `--on-ink`/`--text` em estado neutro. Separador vertical fino entre "Deadline" (hora fixa) e "Restam" (contagem decrescente).

### 6.9 Card claro (info card)
`--surface`, `1px solid var(--border)`, `radius-lg`, padding 20px. Estrutura livre, mas tipicamente: eyebrow no topo, depois ícone/imagem + título (Archivo 600) + subtítulo (`body-sm`, `--text-dim`) + valor em destaque (mono `stat-md`).

Pode incluir um "badge circular" sobreposto (ex. posição "1°") no canto inferior direito de um ícone/avatar: círculo `--ink` com texto `--on-ink`, 24px diâmetro, borda 2px `--bg` para "flutuar" sobre a imagem.

### 6.10 Avatar / ícone circular
Fundo `--gold-soft` ou `--surface-3`, ícone/imagem centrado, sempre circular. Usado no topo da app (perfil) e em badges de conquista.

### 6.11 Barra superior (header)
Logo mark (bloco quadrado `radius-sm`, fundo `--ink`, letra em `--on-ink`) + seletor de contexto central (dot colorido + texto mono, ex. `● Tour · 2026`) + avatar à direita. Fundo transparente/`--bg`, sem borda, apenas separador fino por baixo (`--border`) opcional.

### 6.12 Bottom navigation
Fixa no fundo, fundo `--surface`, borda superior `--border`. 4 itens: ícone + `nav-label`. Estado ativo: ícone e label a `--text` (peso 600); inativo: `--text-sub`. Sem pill/background no item ativo — distingue-se só pela cor (fiel à imagem de referência). Cantos superiores arredondados (`radius-lg`) se a nav for "flutuante" sobre o conteúdo.

### 6.13 Tabela / leaderboard
Mantém o padrão já existente no projeto (linhas alternadas `--surface-2`, medalhas coloridas nos 3 primeiros), mas:
- Todos os números (pontos, posição) passam a mono.
- Nome do participante em Archivo 600.
- Header da tabela em `eyebrow`.

---

## 7. Componentes secundários (biblioteca futura, opcional)

Não fazem parte da direção principal, mas ficam registados como padrões reutilizáveis para ecrãs de dados mais densos (ex. estatísticas por etapa, comparação entre participantes), caso venham a ser precisos:

- **Segmented control** (pill de 2 opções, ex. "Etapa / Geral"): fundo `--surface-3`, opção ativa em `--ink` com texto `--on-ink`.
- **Mini gráfico de barras** (ex. pontos por etapa ao longo da prova): barras em `--ink` com a barra em destaque em `--gold`, sobre `--surface`.
- **Donut/ring chart** (ex. distribuição de pontos por categoria): tons de `--ink`, `--gold`, `--text-sub` — evitar paleta multicolor, manter só 2–3 tons da marca.

---

## 8. Tokens prontos a integrar

Ver `tokens.css` (CSS custom properties + classes de componentes) e o bloco de configuração Tailwind incluído no mesmo ficheiro, para colar em `globals.css` / `tailwind.config.ts` do projeto na fase de implementação.

Ver `style-guide.html` para pré-visualização viva de todos os tokens e componentes acima.

---

## 9. Acessibilidade — verificação de contraste

Todos os pares texto/fundo foram calculados (WCAG 2.1, fórmula de luminância relativa). Resultado depois de um ajuste inicial (algumas cores da paleta original eram claras demais para texto):

| Par | Contraste | Nota |
|---|---|---|
| `--text` / `--bg` | 16.9:1 | ✅ |
| `--text-dim` / `--bg` | 5.3:1 | ✅ AA texto normal |
| `--text-sub` / `--bg` | 3.3:1 | ⚠️ só placeholders/disabled |
| `--gold-ink` / `--gold` (botão CTA) | 9.5:1 | ✅ |
| `--on-ink` / `--ink` (card hero) | 18.4:1 | ✅ |
| `--on-ink-sub` / `--ink` (labels no card hero) | 4.5:1 | ✅ (subido de 0.34→0.45 de opacidade) |
| `--gold` / `--ink` (badge "a decorrer", contador) | 10.9:1 | ✅ |
| `--green-text` / fundo do badge aberta | 5.8:1 | ✅ (cor de badge escurecida vs `--green` de identidade) |
| `--amber-text` / fundo do badge fechada | 6.2:1 | ✅ (idem) |
| `--medal-2` / `--bg` | 4.3:1 | ✅ (escurecida de `#9CA3AF` para `#6E7480`) |

Regra geral para quem for implementar: **nunca** usar `--text-sub` ou `--text-muted` para texto que o utilizador precisa de ler — só para placeholders, estados disabled ou elementos puramente decorativos.

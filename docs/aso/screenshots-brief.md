# Brief de screenshots — loja

> **Como gerar (desde 14/11/2026):** usar a skill **`app-store-screenshots`**
> (`~/.claude/skills/app-store-screenshots`, fonte github.com/ParthJadhav/app-store-screenshots).
> Ela cria um editor Next.js à parte (colocar em `store-assets/screenshots-editor/`, fora do app Expo),
> onde as capturas entram com moldura de aparelho, título e fundo, e exporta em lote nas resoluções
> da App Store (iPhone 6,9"/6,7", iPad) e do Google Play (celular, tablet, feature graphic 1024×500).
> As capturas cruas saem do modo demo do app (`npx expo start --web`, 430×932, ou o iPhone pelo Expo Go).

Público na loja: gestor/atendente que busca **Operax** ou “atendimento fila CRM”.  
Tempo de decisão: 3–6s → **slots 1–3 decidem**.

## Ordem recomendada (iPhone 6.7" + Android phone)

| Slot | Headline (≤6 palavras) | Tela do app | Nota |
|------|------------------------|-------------|------|
| 1 | Assuma a fila agora | Drawer Fila + Assumir | Hook do job-to-be-done |
| 2 | Seus atendimentos no bolso | Home Atendimento (lista) | Clareza do dia a dia |
| 3 | Responda sem perder a posse | Conversa + status “Com você” | Prova de uso |
| 4 | Avisos que chegam a tempo | Avisos | Push / urgência |
| 5 | Preferências sob controle | Prefs push | Confiança LGPD-ish |
| 6 | Tudo em Mais | Hub Mais | Densidade sem assustar |
| 7 | Agenda do dia | Agenda | Secundário |
| 8 | Entre com sua empresa | Login (opcional) | Só se necessário; preferir evitar login como #1 |

### Telas novas para considerar (redesign tonal, nov/2026)

| Tela | Por quê |
|------|---------|
| Agenda em linha do tempo (linha da hora atual) | Mostra o dia de relance, muito visual |
| Conversa com "+" (Pix, agendar) | Prova de que se resolve tudo pelo app |
| Chat da equipe com aviso de mensagem | Diferencial: CRM + comunicação interna |
| Cliente: Início, Treino e Evolução (antes/depois) | Lado do cliente final, se a listagem cobrir os dois públicos |

## Regras criativas

- Captions em **benefício**, não nome de feature (“Assuma a fila” ≠ “Drawer”).
- UI real do build (não inventar telas).
- Fundo navy/cobalt Operax; tipografia Inter; sem texto no ícone.
- Evitar logos WhatsApp/Meta grandes (trademark); canal pode aparecer como label na UI.
- Play: também **feature graphic** 1024×500 com mark + “Atendimento e Fila”.

## Assets internos atuais

Fonte: `screenshots/` (capturas web phone).  
Próximo passo produção: exportar em resoluções oficiais (ASC / Play) com device frame ou frameless consistente.

## Preview video (P2)

15–30s, sem áudio obrigatório, legendas:
1. Abre fila → Assumir  
2. Responde mensagem  
3. Badge de posse / avisos  
CTA final: “Operax — atendimento em campo”

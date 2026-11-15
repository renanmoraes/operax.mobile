# PDV no celular (venda em campo)

Levantamento do PDV do Operax web (`operax-frontend/src/apps/pos`) e do que vem para o app.
Regras combinadas com o dono (2026-11-14):

- Só online.
- O pagamento é só registrado: o app não cobra nem fala com maquininha.
- O comprovante vai ao cliente por WhatsApp ou e-mail (sem impressora).
- Cadastro de cliente em passos, mostrando só o que cada venda exige.

## Fase 1: venda completa no celular

| Área | O que o web faz | No celular |
|---|---|---|
| Achar produto | Um campo só: bipar código, digitar código ou nome | Câmera lê código de barras e QR, mais campo de busca por nome/código |
| Código | `POST /apps/pos/barcodes/resolve`: código exato, EAN-13, etiqueta de balança (peso variável já vem com a quantidade) | Igual |
| QR da etiqueta | QR `{app:'operax-inventory', variant_id}` entra direto | Igual (pela câmera) |
| Oferta | Selo, "de/por" riscado, limite do lote (passou do limite: a linha se divide em duas partes com preços diferentes), validade quando ligada | Igual: `cart.ts` do web vira lógica do app, com os mesmos testes |
| Por unidade | Bipar de novo soma na mesma linha ("5x") | Igual, mais botões − e + |
| **Venda no kg** | Digita as **gramas** e o valor é calculado, ou digita o **valor (R$)** e as gramas são calculadas. A conta fecha no centavo e respeita a oferta do lote | Igual, com teclado numérico grande e alternância "por peso" / "por valor" |
| Outras medidas | Peso com até 4 casas (litro, metro…) | Igual |
| Pesagens | Cada pesagem é uma linha (0,735 kg + 0,420 kg não se juntam). Sem pesar, não fecha | Igual |
| Desconto na linha | %, R$, preço unitário combinado, total da pesagem (só peso). Depende de `pos:discount_line` / `pos:price_override` | Igual |
| Desconto no total | % ou R$ (`pos:discount_order`). O limite sem aprovação é do servidor | Igual |
| Cliente | Avulso ou buscar existente | Igual, **mais cadastro novo em passos** (o web não cadastra na venda) |
| Vendedor | Escolha quando há mais de um | Igual |
| Caixa | Empresa com caixa: vender exige caixa aberto. Abrir com o valor inicial; faixa do caixa aberto | Igual |
| Receber | Relê preços antes (oferta pode ter acabado). Formas: dinheiro, Pix, débito, crédito, transferência, outro. Dividir em várias formas, e a soma tem de fechar | Igual, **mais cálculo de troco** no dinheiro (só na tela) |
| Crediário | Com cliente e ligado nas configurações: parcelas e 1º vencimento | Igual |
| Crédito do cliente | Vira forma de pagamento quando há saldo; não passa do saldo | Igual |
| Plano | Produto marcado como plano abre o contrato de associado (precisa de cliente com CPF) | Igual: o passo do CPF aparece quando há plano no carrinho |
| Fim da venda | Número da venda, comprovante impresso | Número da venda e **comprovante em PDF, enviado por WhatsApp/e-mail** |
| Sem venda duplicada | `idempotency_key` por carrinho | Igual |
| Vendas do dia | Ver produtos e pagamento, reimprimir, corrigir pagamento (`pos:payment_edit`), cancelar com motivo (`pos:void`) | Igual (reenviar comprovante no lugar de reimprimir) |

### Cadastro de cliente em passos

1. **Contato:** nome e WhatsApp (o servidor exige), e-mail opcional. Avisa duplicado por telefone, e-mail ou CPF (409).
2. **Documento:** CPF (obrigatório quando há plano) e foto do documento (`POST /contacts/:id/documents/upload`).
3. **Dados extras:** endereço e campos personalizados de contato da empresa.
4. **Consentimento (LGPD):** `POST /contacts/:id/consents`.

## Fase 2

- **Caixa completo:** sangria e suprimento, fechar com contagem, corrigir abertura, desfazer lançamento.
- **Crediário:** receber parcelas (uma ou várias), quitar com desconto, cancelar e restaurar, comprovante de recebimento.
- **Relatórios:** resumo (bruto, desconto, líquido, ticket médio), por forma de pagamento, ofertas, quem está devendo, caixas do período.
- **Carnê Sicredi** depois de vender plano.
- **Comprovante enviado pelo Operax:** número e e-mail da empresa, guardado na conversa. Precisa de rota nova no servidor e de modelo de mensagem do WhatsApp.

## Fica no web

Fechamentos contábeis, ocorrências do Balcão, perfis de etiqueta de balança, configurações do PDV, importação de produtos.

## Gates

- O app `pos` instalado (`GET /tenant/apps/ui-contributions`) e as permissões `pos:*`.
- Caixa, crediário e limite de desconto vêm do `GET /apps/pos/bootstrap`.

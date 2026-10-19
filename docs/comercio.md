# Ovos, papelaria e gelinhos/Kbom

## Activação

Depois das migrações existentes (incluindo `20260727_management_phase2.sql`), executar uma vez `supabase/20261019_comercio_e_receitas.sql` no SQL Editor do projecto Supabase. A migração é transaccional e preserva os registos existentes. Não foi executada contra o serviço remoto durante esta alteração.

Actualizar a aplicação estática publicada com os ficheiros deste checkout. As duas áreas aparecem no menu do JENI Frangos. As permissões seguem o módulo de ovos: utilizadores autenticados partilham os registos comerciais.

## Utilização

- Registar os produtos separadamente em Papelaria e Gelinhos e Kbom. O nome pode incluir marca, sabor ou variante.
- Registar entrada/produção para adicionar stock; perda/quebra para retirar unidades sem receita.
- Registar venda com cliente, quantidade, preço e valor pago agora. Para crédito integral, indicar zero. A venda retira stock; apenas o pagamento entra na receita recebida.
- Seleccionar uma venda em Pagamentos pendentes para receber parte ou a totalidade da dívida. A operação rejeita pagamentos acima do saldo e conserva o histórico de recebimentos.

Os valores das duas novas áreas são controlados nos respectivos painéis. Não geram movimentos nas contas financeiras gerais da avicultura nem se somam automaticamente aos relatórios institucionais.

Nos ovos, o modelo existente considera a venda integralmente paga quando existe `payment_method`; as vendas sem método permanecem por receber. A correcção aplica este critério à página de ovos e às vistas de resumo. A página percorre todas as páginas de vendas, evitando totais limitados às vendas recentes. Não foi introduzido pagamento parcial de ovos.

## Validação local

```sh
python3 -m http.server 8010 --bind 127.0.0.1
```

Noutro terminal, com Node, Chromium e Playwright disponíveis:

```sh
node tests/commerce-browser.cjs
npm install --prefix /tmp/jeni-validation --cache /tmp/jeni-npm-cache --no-audit --no-fund @electric-sql/pglite
PGLITE_MODULE=/tmp/jeni-validation/node_modules/@electric-sql/pglite node tests/commerce.test.cjs
```

O teste de base de dados usa PostgreSQL temporário via PGlite e valida a migração, receitas recebidas, stock, pagamentos parciais, perdas, rejeição de excesso de stock/pagamento e permissões. O teste de navegador usa API simulada e não envia registos ao Supabase real.

## Custo de aquisição e custo técnico

Aplicar também, uma vez e após a migração anterior, `supabase/20261019_custos_comercio.sql`. Na papelaria, usar “Registar compra” e informar o artigo, a quantidade e o valor total pago pela compra. Não existem campos de produção ou embalagens nesta área. Nos gelinhos, usar “Adicionar stock” e informar a quantidade final e o custo total de produção ou compra. A calculadora de ingredientes, saquinhos, energia, mão de obra e outros gastos é opcional; quando usada, a discriminação fica nas observações do movimento. O custo total dividido pela quantidade dá o custo unitário.

O stock usa custo médio ponderado: `(valor do stock anterior + custo do novo lote) / (quantidade anterior + quantidade recebida)`. As vendas e perdas guardam o custo na data do registo; novas entradas não alteram o custo de vendas anteriores. A data informada não reordena o cálculo: o custo segue a ordem de registo dos movimentos.

O painel mostra custo dos produtos vendidos, lucro bruto sobre todas as vendas (incluindo as que estão a crédito) e valor do stock ao custo. Receita recebida e dívida permanecem separadas. O lucro bruto não deduz perdas/quebras nem despesas que não foram incluídas nos custos dos lotes.

Não se inventam custos de movimentos antigos: ficam como “Não informado” e os totais afectados são assinalados como parciais. Para produtos com stock anterior sem custo, o formulário “Valorizar stock antigo” permite indicar uma única vez o custo unitário do stock actual. Isto permite novos movimentos sem modificar o histórico de vendas.

A interface mostra uma tarefa de cada vez: Vender, Registar compra/Adicionar stock, Produtos e stock, Receber dívida e Histórico e perdas. Começa na venda quando já existem produtos; sem produtos, começa no cadastro. As explicações de cálculo e observações ficam recolhidas até serem necessárias. Esta simplificação não exige nova migração SQL.

## Venda com preço e custo automáticos

Aplicar `supabase/20261019_venda_rapida_comercio.sql` depois das duas migrações anteriores. O registo normal de venda pede apenas produto, quantidade e método de pagamento (Dinheiro, M-Pesa, e-Mola ou Transferência). Preço e custo unitários aparecem automaticamente, com o total calculado. O servidor lê o preço declarado e o custo médio do produto no momento de guardar; não recebe preço nem custo editáveis do formulário de venda. A data é a data actual.

A venda normal fica paga pelo total. “A crédito — pagar depois” exige o cliente e mantém o total em dívida. A opção recolhida “Cliente ou pagamento parcial” permite identificar o cliente ou indicar um recebimento parcial; se restar dívida, o cliente é obrigatório. O método escolhido é guardado na venda e no recebimento inicial. Pagamentos posteriores continuam pelo formulário Receber dívida.

O custo continua a ser declarado nas compras/produção e calculado no stock; a venda reutiliza-o automaticamente. Registos antigos sem método de pagamento mantêm esse campo desconhecido.

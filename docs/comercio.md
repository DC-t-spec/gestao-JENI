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

Aplicar também, uma vez e após a migração anterior, `supabase/20261019_custos_comercio.sql`. Nas entradas/produção, informar a quantidade final do lote e os custos totais de compra/ingredientes, embalagens, energia/água, mão de obra e transporte/outros. A discriminação fica nas observações do movimento. O custo total dividido pela quantidade produzida dá o custo unitário do lote.

O stock usa custo médio ponderado: `(valor do stock anterior + custo do novo lote) / (quantidade anterior + quantidade recebida)`. As vendas e perdas guardam o custo na data do registo; novas entradas não alteram o custo de vendas anteriores. A data informada não reordena o cálculo: o custo segue a ordem de registo dos movimentos.

O painel mostra custo dos produtos vendidos, lucro bruto sobre todas as vendas (incluindo as que estão a crédito) e valor do stock ao custo. Receita recebida e dívida permanecem separadas. O lucro bruto não deduz perdas/quebras nem despesas que não foram incluídas nos custos dos lotes.

Não se inventam custos de movimentos antigos: ficam como “Não informado” e os totais afectados são assinalados como parciais. Para produtos com stock anterior sem custo, o formulário “Valorizar stock antigo” permite indicar uma única vez o custo unitário do stock actual. Isto permite novos movimentos sem modificar o histórico de vendas.

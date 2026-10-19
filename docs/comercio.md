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

## Dinheiro disponível e reposição de stock

Aplicar uma vez `supabase/20261019_caixa_comercio.sql`, depois da migração de venda rápida. Ao registar uma compra/produção, indicar se foi paga com capital próprio ou com dinheiro das vendas. O custo contabilístico e a quantidade de stock continuam separados desta origem do dinheiro.

O painel distingue:

- Total recebido das vendas: soma dos pagamentos efectivamente recebidos, sem descontar compras.
- Dinheiro disponível das vendas: pagamentos recebidos menos compras pagas com esse dinheiro.
- Capital aplicado no stock: compras financiadas por investimento próprio; aparece nos detalhes e não entra nas receitas de vendas.
- Lucro bruto: vendas menos o custo dos produtos vendidos, e não o saldo em caixa.

Exemplo confirmado pelo utilizador: capital de 180 + 180 + 400 = 760 MZN; vendas recebidas de 1316 MZN; segunda compra de Kbom de 400 MZN paga com vendas. Dinheiro disponível: 1316 − 400 = 916 MZN. O stock remanescente mantém a sua valorização ao custo.

No Histórico, confirmar a origem das compras anteriores: as três entradas iniciais como Capital e a reposição de Kbom como Dinheiro das vendas. Não há alteração automática desses registos remotos. A origem pode ser corrigida sem criar outra compra, mudar stock ou reescrever vendas. Sem origem/custo conhecido em todas as compras com custo, o saldo fica “Por apurar”. Registos gratuitos não precisam de classificação para apurar o saldo.

O saldo abrange apenas os movimentos registados nesta área. Não inclui levantamentos, outras despesas ou capital ainda não aplicado. O custo total registado numa entrada é tratado como pago pela fonte indicada; não há contas a pagar a fornecedores neste fluxo.

Teste adicional: `node tests/retail-cash.test.mjs`.

## Papelaria: artigos, serviços e consumíveis

Aplicar uma vez `supabase/20261019_servicos_papelaria.sql` depois de todas as migrações acima. Os registos existentes são conservados como artigos. Não são criados preços nem custos fictícios.

Em **Artigos e serviços**:

1. Registar os artigos de revenda (cadernos, canetas, etc.), os serviços (por exemplo, Cópia A4 preto e branco e Impressão A4 a cores) e os consumíveis (papel, toner e agrafos). Cada serviço tem o seu próprio preço por página. Os consumíveis não têm preço de venda e não aparecem na venda ao cliente.
2. Em **Registar compra**, dar entrada dos consumíveis, com quantidade, custo total e origem do dinheiro. Usar a unidade base escolhida: uma resma de 500 folhas entra como 500 folhas, não como 1 folha; um cartucho pode entrar como 1 cartucho.
3. Em **Custo de cópias e impressões**, associar os consumíveis ao serviço. Exemplo: papel, 1 folha por página; toner, 0,001 cartucho por página quando o rendimento estimado é de 1.000 páginas/cartucho; agrafos, 1 ou 2 por trabalho, conforme o serviço prestado. As quantidades são configuradas pelo utilizador conforme os seus materiais e equipamento. Para frente e verso, configurar o consumo de papel adequado por página impressa.

Na venda, seleccionar o serviço, a quantidade de páginas e o pagamento. O servidor desconta os materiais automaticamente, incluindo quantidades fraccionárias de toner, guarda o custo do trabalho e cobra apenas `páginas × preço do serviço`. Não adiciona o preço dos agrafos ao total cobrado. O custo de toner por página é uma estimativa baseada no rendimento informado; não é uma medição da máquina.

Os serviços não precisam de stock fictício e não aceitam compras/perdas. Os consumíveis têm stock físico, custo médio e valorização, são consumidos no serviço e não podem ser vendidos separadamente. Se também vende caixas de agrafos ao público, registar esse artigo de revenda separadamente dos agrafos usados no serviço.

Custos e quantidades consumidas ficam gravados por venda em `retail_service_consumptions`, pelo custo médio de cada material no momento do trabalho. Uma compra posterior ou alteração da composição não altera o custo de trabalhos anteriores. Falta de materiais ou de configuração impede guardar a venda inteira. O pagamento e o consumo são atómicos, sem criar receitas adicionais pelo consumo de materiais.

A compra dos consumíveis entra no cálculo de caixa conforme a origem do dinheiro; o consumo entra no custo do serviço e não é descontado novamente da caixa. O lucro bruto considera os materiais consumidos; despesas gerais da papelaria que não estejam registadas nos custos não estão incluídas nesse lucro.

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

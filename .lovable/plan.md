# Exclusão de Alunos/Responsáveis + Financeiro das Empresas

## O que já existe (e será preservado)
- Alunos, Responsáveis, Cursos, Turmas, Professores continuam funcionando igual.
- As empresas já têm uma tela de "Faturas". Ela será ampliada, não substituída.
- A cobrança de alunos (mensalidades) e a cobrança de empresas continuam separadas.
- Nenhum dado existente será apagado.

## Etapa 1 — Excluir Alunos e Responsáveis
- Botão "Excluir" na lista de Alunos e na de Responsáveis, visível apenas para Administrador e para o super administrador.
- Caixa de confirmação: "Tem certeza que deseja excluir este aluno? Esta ação não poderá ser desfeita."
- A exclusão remove também os vínculos aluno–responsável automaticamente, sem erro.
- Se o aluno tiver matrícula, notas, diário ou cobranças, o sistema avisa e faz a exclusão de forma controlada, sem quebrar históricos financeiros: esses registros ligados são removidos junto na mesma operação, exceto pagamentos já quitados, que bloqueiam a exclusão com aviso claro.

## Etapa 2 — Financeiro das Empresas
### Banco de dados
- Empresas ganham um campo para guardar o identificador do cliente no meio de pagamento.
- As faturas de empresa ganham: situação fiscal (Pendente/Emitida/Erro), número da nota, link do PDF e do XML — separados da situação financeira (Paga, Pendente, Vencida, Cancelada).
- Nova tabela de mensalidade recorrente da empresa: valor, dia de vencimento, forma de pagamento, situação (Ativa/Inativa).
- Acesso: Administrador gerencia tudo; Secretaria consulta.

### Cobrança automática
- Ao gerar a cobrança de uma empresa, o sistema cria o cliente no meio de pagamento na primeira vez (CNPJ, razão social, e-mail) e reaproveita depois.
- O mesmo aviso de pagamento já usado nos alunos passa a atualizar também as faturas de empresa, sem duplicar baixas quando o aviso chega mais de uma vez.

### Tela /empresas → aba Financeiro
- Cartões de resumo: Em aberto, Vencido, Pago no período.
- Tabela de cobranças: descrição, vencimento, valor, situação financeira, situação fiscal e ações.
- Botão "Nova cobrança avulsa" (descrição, valor, vencimento, forma de pagamento).
- Área para configurar a mensalidade recorrente da empresa.
- Ao abrir uma cobrança: código PIX copia e cola, link do boleto e links dos documentos fiscais quando existirem.

## Detalhes técnicos
- Migrações: `empresas.asaas_customer_id`; em `faturas_empresas` os campos `status_fiscal` (padrão 'PENDENTE'), `numero_nfse`, `url_pdf_nfse`, `url_xml_nfse`; nova tabela `mensalidades_empresas` com GRANTs + RLS (admin/superadmin ALL, secretaria SELECT).
- `mensalidades` já cobre o B2C; a coluna `empresa_id` do pedido é atendida por `faturas_empresas.empresa_id`, que já existe — não haverá tabela `cobrancas` duplicada.
- Server functions em `src/lib/asaas.functions.ts`: `gerarCobrancaEmpresaAsaas` reutilizando `asaas.server.ts` (`ensureAsaasCustomer` estendido para CNPJ).
- Webhook `src/routes/api/public/asaas-webhook.ts`: após tentar `mensalidades`, atualiza `faturas_empresas` pelo `asaas_payment_id`, com update idempotente (só altera quando o status ainda não está pago).
- Exclusão: server function admin-only usando o cliente de serviço, apagando dependências em ordem (`aluno_responsavel`, `diario_chamada`, `avaliacao_notas`, `matriculas`, `mensalidades` não pagas) antes do registro principal.

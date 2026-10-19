# Validação local da reorganização

- PHP: 21 verificações de domínio e lint dos arquivos movidos.
- API pública/MariaDB descartável: 52 verificações (numeração, concorrência, idempotência, recuperação, rollback, prazo e isolamento).
- Administração/MariaDB descartável: 75 verificações, incluindo 404 dos caminhos removidos, login, faixas, permissões, isolamento, confirmação de pagamento e auditoria.
- Navegador: 20 verificações públicas, 13 de consulta, 9 de nova entrada e 20 administrativas (desktop/celular).
- Apache local isolado: 11 acessos privados recusados com 403 e um asset público acessível com 200.
- Builds KIDS e atendimentos aprovados, com TypeScript sem emissão em ambos. O build KIDS gera somente kids/admin/dist/; o dashboard gera somente dashboard/dist/.
- Busca estática sem referências ativas aos caminhos removidos no cadastro, frontend ou backend de aplicação. Referências nos testes de ausência e relatórios históricos são intencionais. O runner administrativo copia o build de atendimentos apenas para testar sua regressão, não para servir a administração KIDS.

Foi corrigida uma colisão de variável no runner administrativo: o resultado de um login inválido usava o mesmo nome do sinalizador de falha geral e causava código de saída 1 mesmo com todas as verificações aprovadas.

Previews, fixtures e SQL foram executados somente em diretórios/bancos temporários novos. Nenhuma leitura de credenciais privadas existentes, publicação ou alteração de dados reais. Configuração fonte mantém inscrições bloqueadas. Sem PDF.

Limitações: HTTP local, usuários fictícios, esquema mínimo de atendimentos, sem TLS ou validação da hospedagem real. A troca física dos caminhos exige novo login administrativo e nova sessão pública; não transfere cookies de previews antigos. Detalhes, dependências compartilhadas e comandos em REORGANIZACAO.md. Resultados e capturas em ../tests/.

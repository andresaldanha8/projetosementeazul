> Banco KIDS já instalado: seguir [ATUALIZACAO-IMAGEM.md](ATUALIZACAO-IMAGEM.md) e importar somente a migration 006. Não reaplicar o instalador consolidado.
> Correção administrativa posterior com produção aberta: seguir **CORRECAO-ADMIN-IMAGEM.md** e usar somente o ZIP de quatro arquivos. Não executar SQL nem substituir configurações. Os ZIPs completos abaixo são material para instalação nova com configuração fechada.

# KIDS — preparação independente, produção fechada

Entrega local de 18/10/2026. Sem conexão à Hostinger, SQL remoto ou publicação. Esta versão substitui os pacotes anteriores e remove conexão/identidade compartilhadas com atendimentos. A preparação anterior está preservada apenas em history/PREPARACAO-PRODUCAO-COMPARTILHADA.md; não seguir suas instruções de banco/senha.

Guia vigente completo: operations/INSTALACAO-INDEPENDENTE.md no release, ou kids/docs/INSTALACAO-INDEPENDENTE.md no projeto.

1. Selecionar o banco exclusivo vazio u330320079_kids no phpMyAdmin.
2. Importar operations/install-kids-empty.sql uma única vez. Não executar também migrations 001 a 006.
3. Copiar upload/kids/config/database.example.php para kids/config/database.local.php e preencher host/porta, banco, usuário e senha privadamente. Banco/usuário: u330320079_kids; senha nunca deve ir ao chat.
4. Criar identidade KIDS nova com SQL offline ou CLI privada, conforme o guia. Não há conta/senha padrão nem cópia de usuários.
5. Em etapa futura autorizada, enviar somente upload/kids/, preservar a configuração privada e conferir HTTPS/bloqueios. Não publicar o kit inteiro ou alterar arquivos de atendimentos.

kids-runtime-20261018.zip contém somente kids/. kids-release-20261018.zip contém runtime, manifesto, operações privadas e referências opcionais de home/CSS/assets. Ambos substituem os anteriores. Nenhum PHP de atendimentos é distribuído. Configuração preenchida, banco, usuários, testes, fixtures, PDFs de exemplo e logs são excluídos.

Produção: public_open=false e declaração KIDS-2026-v2. A instalação não autoriza abertura. Nenhum banco existente foi limpo; preview antigo preservado sem conversão/sincronização. A validação nova usa banco local vazio separado, com usuário MySQL sem acesso a outras bases. Evidências e detalhes no guia vigente.

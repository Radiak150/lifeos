# Validação - LifeOS 0.2.0 - 23/09/2026

## Conferido

- TypeScript e build de produção concluídos.
- Lint concluído sem avisos.
- 47 testes, em 8 arquivos, aprovados. Incluem inicialização em branco, preservação de instalações antigas, pacote básico, água e desfazer, XP, migrações e backup.
- Defaults sem perfil, agenda ou tarefas pessoais do autor. Importações v1 não completam campos ausentes com informações de outra pessoa. A preservação do perfil, agenda, tarefas e hábitos legados está coberta por testes com dados sintéticos.
- 9 verificações da API de compartilhamento aprovadas: autorização, leitura distinta, bloqueio de edição pelo leitor, arquivos cifrados, atualização SSE, rejeição de dados indevidos, origem, reinício e revogação.
- Navegador isolado em 5184: primeiro acesso, Projetos/Casa/Pets, pacote básico, noite de teste de 8h, rascunho preservado ao trocar de aba, histórico e conclusão automática do sono.
- Água: 200 ml de teste atualizaram Meu dia; a quantidade e o tema persistiram após recarregar.
- Modo escuro e menu recolhido conferidos visualmente. Layout de 390px conferido; excesso de largura da barra de água corrigido.
- Nova verificação móvel: painel de água sem largura excedente; Casa/Pets/Projetos separados; menu abre e fecha ao navegar; guia mostra uma etapa por vez.
- Executável Windows abriu em janela própria no endereço local lifeos://app e exibiu o primeiro acesso. Não foi preenchido com os dados pessoais do usuário.
- Instalador Windows e APK foram gerados novamente após a limpeza de privacidade. O índice da interface dentro de ambos os pacotes corresponde ao build final.
- Assinatura de desenvolvimento do APK verificada com apksigner. O instalador Windows permanece sem assinatura comercial; essas verificações não substituem testes de instalação em dispositivos reais.
- Nota PDF de 4 páginas renderizada e conferida visualmente.

## Ainda não validado

- Instalação/desinstalação completa em uma máquina Windows limpa e assinatura comercial do instalador.
- Execução e persistência do APK em aparelho Android físico; não havia aparelho conectado.
- Serviço público HTTPS entre duas redes. As verificações de SSE citadas acima são locais.
- Conta online, login, recuperação de conta ou sincronização bidirecional: não implementados.

## Não confundir

Salvar no aparelho dispensa exportação diária, mas não elimina necessidade de recuperação em caso de perda do aparelho. O compartilhamento é uma cópia seletiva de leitura, não uma conta sincronizada. A ilustração não é uma visualização dos dados. O APK é uma versão de teste, não um lançamento em loja.

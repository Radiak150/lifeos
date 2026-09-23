# Colaboração no LifeOS

## Fonte e dados

O código em `src`, `scripts`, `electron` e `android` é a fonte. Não editar arquivos gerados em `dist` ou em pacotes de instalação. Preservar a base `lifeos` e os identificadores antigos: `fushi` é o identificador interno legado da área Projetos, não o nome exibido.

Nenhum backup de paciente, chave de assinatura, `.env`, pasta AppData ou cópia do servidor deve entrar no Git. Os testes criam bases separadas com dados explicitamente sintéticos.

## Ciclo de mudança

1. Descrever o fluxo que será alterado.
2. Implementar preservando os registros antigos e o contrato de compartilhamento.
3. Executar lint, testes, integração do compartilhamento e build.
4. Conferir no navegador isolado, nas larguras desktop e celular, nos dois temas.
5. Se a distribuição mudar, gerar e testar novamente o instalador e o APK.

## Repositório

Repositório privado: https://github.com/Radiak150/lifeos. O responsável autorizou a criação para colaboração no código. Não alterar a visibilidade nem convidar pessoas sem autorização. Não publicar documentos acadêmicos e comentários do orientador junto do código sem autorização específica.

## Prioridades pendentes

- Escolher hospedagem e domínio; publicar o serviço com HTTPS e disco privado persistente.
- Implementar autenticação real, recuperação de conta e consentimento apropriado para o piloto, se o cadastro online permanecer requisito.
- Testar paciente e terapeuta em aparelhos/redes diferentes, incluindo interrupção e retomada da conexão.
- Testar o APK em aparelho físico e preparar assinatura de produção sem compartilhar a chave.
- Fazer validação de usabilidade com participantes autorizados; não anunciar eficácia clínica sem estudo.

## Dependências

Após correções compatíveis, a auditoria não encontrou vulnerabilidades nas dependências de produção. Permanecem avisos moderados na cadeia de ferramentas de iOS (`@capacitor/cli > xcode > uuid`). iOS não é alvo desta entrega. Não usar correção forçada que altere versões sem testar novamente.

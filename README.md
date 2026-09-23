# LifeOS

Aplicativo de organização da rotina, com registros locais e compartilhamento seletivo para acompanhamento. Versão 0.2.0.

## Usar

- Windows: instalador em `deliverables/LifeOS-Instalador-0.2.0.exe`.
- Android: APK de desenvolvimento em `deliverables/LifeOS-Android-0.2.0-teste.apk`.
- Navegador: `npm ci`, `npm run build` e `npm start`; abrir http://127.0.0.1:5181.

Os instaladores são distribuídos separadamente; a pasta `deliverables` não é versionada neste repositório.

O instalador Windows cria atalhos e usa a pasta de dados `%APPDATA%/LifeOS`. O APK contém os recursos da interface. Os registros são salvos no dispositivo sem exportação a cada uso. Exportar continua útil para recuperação e transferência. Desinstalar ou limpar dados pode apagar os registros.

Dados de um navegador não migram automaticamente para o aplicativo nativo: exporte e importe em Configurações → Dados. Preserve a origem até conferir a migração. Não use a porta de teste 5184 para sua rotina pessoal.

## Funcionalidades

- Primeiro acesso por etapas; perfil local, áreas opcionais e pacote de higiene, sono e água.
- Início leve, guia no começo do menu e modos claro/escuro.
- Meu dia, Sono, Agenda, Evolução e Terapia separados por função em abas.
- Categorias próprias, Projetos, Estudos, Casa e Pets com identidade distinta.
- Hábitos, tarefas, agenda, registros de sono, água e estado do dia.
- XP e conquistas derivados dos registros, sem histórico artificial.
- Compartilhamento seletivo de leitura, com atualização via SSE, expiração e revogação.

## Limites importantes

O perfil inicial não é uma conta online. Cadastro/login em servidor, recuperação de conta e sincronização da rotina entre aparelhos ainda não foram implementados. O acompanhamento pela internet precisa de serviço HTTPS publicado. A versão local NÃO cria uma hospedagem pública.

O serviço existente envia apenas a seleção autorizada e exige o app aberto e conectado. Sem rede, os registros ficam locais; ao reabrir e reconectar, o envio retoma. Links privados não verificam a identidade de quem recebeu o endereço. Detalhes em [PUBLICAR-ONLINE.md](docs/PUBLICAR-ONLINE.md).

APK de teste: ainda sem verificação em aparelho físico ou assinatura de produção. Instalador Windows: sem certificado comercial de assinatura. Não é uma liberação clínica nem um serviço público pronto.

## Desenvolvimento

Repositório privado: https://github.com/Radiak150/lifeos. Para colaborar, o responsável precisa conceder acesso à conta do colega. Não compartilhar credenciais.

Node.js 24 e npm:

```sh
git clone https://github.com/Radiak150/lifeos.git
cd lifeos
npm ci
npm run dev -- --host 127.0.0.1 --port 5184 --strictPort
npm run lint
npm run test:run
npm run test:sharing
npm run build
npm run package:installer
npx cap sync android
```

Para Android, configurar JDK 21 e Android SDK 36; dentro de `android`, executar `gradlew.bat assembleDebug`. A chave de desenvolvimento é local. Nunca versionar chaves, senhas ou dados de pacientes.

## Por que essas ferramentas

React reaproveita componentes; TypeScript verifica formatos; CSS define identidade e adaptação; Dexie organiza o IndexedDB e suas transações; Vite gera a aplicação; Vitest confere regras; Electron fornece janela/instalador Windows; Capacitor reutiliza a interface no Android. O serviço Node envia cópias seletivas por HTTP/SSE. Não há modelo de IA analisando pacientes.

[Identidade visual](docs/IDENTIDADE-VISUAL.md) · [Validação desta versão](docs/VALIDACAO-0.2.md) · [Colaboração](docs/COLABORACAO.md)

O LifeOS organiza autorrelatos. Não realiza diagnóstico nem substitui acompanhamento profissional.

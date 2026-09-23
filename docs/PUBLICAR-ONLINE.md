# LifeOS: rotina offline, acompanhamento online

## Estado desta entrega

O código inclui o serviço e a página de leitura da terapeuta. O ZIP não cria uma hospedagem pública. Os testes locais verificam a comunicação entre clientes, mas não substituem o teste final entre dois aparelhos pela internet.

## O que precisa ser publicado

Use **um serviço Node.js 24**, HTTPS, processo contínuo e um disco persistente privado. O mesmo endereço entrega a interface e `/api/shares`. Não basta hospedar somente a pasta `dist`. O piloto foi desenhado para **uma instância**, até 100 links ativos e até 10 leitores por link. Não escale em réplicas sem alterar o mecanismo de transmissão.

1. Compilar: `npm ci` e `npm run build`.
2. Na hospedagem, enviar `dist`, `scripts/serve.mjs` e `scripts/sharing-api.mjs` (ou construir com o Dockerfile). Não enviar backups ou dados do usuário.
3. Configurar as variáveis abaixo no painel privado da hospedagem. Nunca incluí-las no código, em screenshots ou no PDF.
4. Iniciar: `node scripts/serve.mjs`. A hospedagem fornece TLS/HTTPS, encaminha a porta e deve permitir conexões SSE longas, sem buffering ou cache de `/api/`.
5. Abrir o endereço HTTPS, concluir o Guia e aguardar a confirmação offline. No celular, usar a instalação oferecida pelo navegador; iOS: Safari, Compartilhar, Adicionar à Tela de Início. Isso é PWA, não APK nem publicação em loja.
6. Em Compartilhar, informar a origem HTTPS, o código de publicação, a identificação e os dados escolhidos. Confirmar a autorização e enviar o link diretamente à terapeuta.

| Variável | Valor / motivo |
| --- | --- |
| `LIFEOS_PUBLIC_ORIGIN` | `https://seu-dominio` sem barra final. Origem da interface e do serviço. |
| `PORT` | Porta interna atribuída pela hospedagem, entre 1024 e 65535. Padrão 5181. |
| `LIFEOS_DATA_DIR` | Diretório privado em disco persistente, fora de `dist`, por exemplo `/data/shares`. |
| `LIFEOS_ENCRYPTION_KEY` | 64 caracteres hexadecimais aleatórios (32 bytes). Chave usada para cifrar arquivos. Manter estável e protegida; perdê-la torna as cópias ilegíveis. |
| `LIFEOS_PUBLISH_KEY` | Código aleatório forte, ao menos 16 caracteres, entregue só ao responsável por publicar a rotina. Não é necessário para a terapeuta. |

O Node possui `crypto.randomBytes` para gerar segredos. Eles devem ser gerados pelo responsável no ambiente privado e inseridos no painel da hospedagem, não enviados nesta conversa. Não há chave embutida nem credenciais padrão. Se houver proxy, preserve o Host e desative cache/buffering na API. O limite de requisições usa o IP da conexão: em um proxy compartilhado, o piloto pode atingir esse limite mais cedo.

## Funcionamento e consentimento

O IndexedDB continua sendo a fonte dos registros. O app envia somente as seções escolhidas dos últimos 30 dias, após uma breve espera para agrupar alterações. A página da terapeuta recebe eventos SSE e reconecta se a rede cair. O envio exige o app aberto: não há garantia de execução com a tela fechada ou app suspenso. Offline, o registro fica salvo localmente e será enviado ao reabrir/conectar. A interface informa a última atualização recebida.

Perfil, peso, profissão, tarefas, agenda e textos privados de hábitos/check-ins/sono não são enviados. Notas de terapia exigem a escolha da seção e a marcação individual para compartilhar. Não existe edição remota da rotina nem sincronização entre os dispositivos do titular. Use backup para transferir seu histórico.

Cada link tem chave aleatória de leitura, chave separada de escrita e validade de sete dias. A chave do leitor fica após `#` no link e é enviada à API pelo cabeçalho Authorization, não em parâmetros da URL. Qualquer pessoa com o link pode ler: isso **não verifica a identidade da terapeuta**. A cópia é cifrada no servidor com AES-256-GCM, mas não há criptografia ponta a ponta; o servidor consegue decifrá-la. Revogar remove a cópia do serviço e encerra o stream, sem apagar o histórico local. Dados já copiados pelo leitor não podem ser recolhidos. A limpeza periódica remove cópias expiradas enquanto o serviço estiver em execução. Backups da infraestrutura exigem política própria de retenção.

Credenciais de compartilhamento ficam somente neste navegador e são excluídas do backup exportado. Revogue antes de limpar o navegador ou trocar de aparelho; sem a chave de escrita, o link permanece válido até expirar. Importar outra rotina ou recomeçar fica bloqueado enquanto há vínculo de compartilhamento.

## Aceite final em dois aparelhos

- Dono cria link e o envia por canal privado ao leitor.
- Leitor abre sem passar pelo cadastro inicial e vê somente a seleção.
- Dono altera um registro; leitor recebe a mudança sem recarregar.
- Dono fica offline e registra algo: nada se perde; o leitor mantém a última atualização identificada. Ao reconectar com o app aberto, a seleção atualiza.
- Fechar e reabrir o navegador, testar o ícone instalado no celular e uma reinicialização do servidor.
- Revogar: leitor perde acesso; registros do dono permanecem.

Esse aceite ainda depende da hospedagem escolhida. Antes de uso regular com dados pessoais sensíveis, o responsável precisa definir acesso operacional, retenção, backups, manutenção, orientações de privacidade e revisar a segurança. A entrega é um piloto técnico controlado, não uma plataforma clínica auditada ou um serviço com disponibilidade garantida.

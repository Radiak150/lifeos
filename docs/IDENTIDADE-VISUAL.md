# LifeOS — identidade visual e navegação

Base clara em marfim, verde mineral para ações, violeta para sono, azul para água e terracota para acompanhamento. O modo escuro preserva os mesmos papéis com contraste próprio; não inverte imagens. DM Sans para leitura e Manrope para títulos. Ícones Lucide com identificação textual.

Uma atividade por aba: os formulários permanecem montados ao trocar abas para preservar rascunhos, mas apenas o painel selecionado fica visível. Nenhum indicador fictício. O Início encaminha aos registros; não replica todos os relatórios.

## Ilustração editorial

Arquivo usado: `public/visuals/lifeos-daily-v2.png`. Gerada com a ferramenta de imagens e aplicada no primeiro acesso e no Início. Não representa registros nem resultados clínicos.

Prompt completo: Use case: stylized-concept. Asset type: editorial illustration inside a patient routine and therapist companion app named LifeOS, not a UI screenshot. Primary request: a calm, professional, approachable visual about a manageable daily routine. Scene: a single warm-ivory ceramic tray holding an open small blank planner, a translucent muted blue glass of water, a simple folded fabric and one rounded coral pebble, subtle morning shadow. Style: art-directed still life illustration with tactile paper and ceramic surfaces, restrained organic shapes, human editorial feel, not toy-like, not glossy tech or fantasy. Composition: wide 3:2, objects grouped centrally with generous breathing room, seamless warm off-white background. Palette: ivory, deep muted teal, dusty periwinkle and one small terracotta accent. No text, no letters, no checklists, no UI, no generic floating icons, no glow, no neon, no watermark. Must feel restful and understandable at small scale.

## Integrações nativas

Windows: Electron em processo isolado, sem acesso Node na página, protocolo local estável `lifeos://app`, perfil em `%APPDATA%/LifeOS`. Atualizações não devem apagar esse diretório. O instalador NSIS cria atalhos. Sem certificado comercial de assinatura, o Windows pode exibir aviso de editor desconhecido.

Android: Capacitor, recursos incluídos no APK e registros no armazenamento privado do WebView do aplicativo. Desinstalar ou limpar os dados do app pode apagá-los; armazenamento local não substitui cópia de segurança. A versão de teste usa a assinatura de desenvolvimento, não uma assinatura de produção.

Os registros do navegador anterior não migram automaticamente para um novo aplicativo nativo; a transferência inicial usa exportação/importação em Configurações → Dados. Os registros posteriores ficam salvos sem exportação manual.

Referências de implementação: https://www.electronjs.org/docs/latest/tutorial/security ; https://www.electronjs.org/docs/latest/api/protocol ; https://capacitorjs.com/docs/android ; https://www.electron.build/nsis/

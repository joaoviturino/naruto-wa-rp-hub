# Ateliê shinobi e oficina de jutsus

Esta atualização mantém o RPG por turnos, os atributos, as proficiências, o inventário e a identidade visual preta, vermelha e dourada. O trabalho concentra-se na apresentação dos personagens, na criação de conteúdo e no desempenho do cliente.

## Experimentar e equipar roupas

Em **Personagem → Aparência**, escolha cabelo, rosto, roupa ou acessório, pesquise uma peça e experimente antes de equipar. A prévia oferece oito ações: parado, corrida, soco, chute, dano, conjuração, derrota e defesa. Também permite virar o personagem, pausar, repetir a ação e experimentar vento, chuva e água.

Cada confirmação salva a peça da categoria selecionada. Peças exclusivas continuam sujeitas às regras de personalização e às permissões existentes. A aparência usa as mesmas camadas no inventário e no combate.

Roupas estáticas permanecem inteiras sobre o corpo. Uma roupa animada usa sua própria grade e acompanha o progresso da animação corporal. Vento movimenta discretamente cabelo e tecido; chuva e água escurecem o tecido; conjuração acrescenta brilho de chakra. Essas reações são cosméticas.

## Cadastrar sprites e poses

Use **Admin → Personalização** para peças e o editor de jogador para a spritesheet corporal. O editor de sprites permite selecionar ações, inspecionar um quadro por vez e conferir dimensões, linhas e quantidade de frames.

- Use PNG com transparência e células de tamanho uniforme.
- Colunas representam os quadros; cada ação aponta para uma linha, começando em zero.
- Corpo e roupa podem ter grades diferentes, mas precisam compartilhar a proporção do quadro, o ponto dos pés e o alinhamento do desenho.
- Marque repetição para repouso e corrida. Golpes normalmente terminam no último quadro.
- Uma imagem estática pode usar movimentos de apoio. Poses desenhadas e animações articuladas exigem os respectivos quadros na spritesheet.
- Poses avulsas já cadastradas no personagem têm prioridade durante a ação. As peças frontais são ocultadas nessa pose para evitar sobreposição desalinhada; se a imagem falhar, a aparência normal volta a ser usada.

Não foram produzidas novas pranchas de arte nem uma simulação física de tecido. O sistema permite integrar esse material ao jogo preservando as artes existentes.

## Ambiente dos locais

Em **Admin → Locais → Cenário e som de combate**, selecione o ambiente. Novos encontros PvE e duelos PvP guardam esse valor junto com o cenário e a música. Uma técnica com reação elemental substitui temporariamente o ambiente durante sua ação; depois, o ambiente do local volta a valer.

A migração `supabase/migrations/20260911130000_location_visual_environment.sql` adiciona `locations.visual_environment`, com valor inicial `neutral` e valores permitidos `neutral`, `wind`, `rain`, `water`. Aplique-a no banco usado por esta aplicação para habilitar a gravação do ambiente. Ela preserva as políticas RLS existentes. Sessões antigas e bancos ainda sem a coluna continuam sendo lidos com o ambiente calmo.

**A migração está preparada, mas não foi aplicada em produção.** A conexão disponível nesta sessão não permitiu consultar o banco do jogo; não houve alteração no banco conectado de outro projeto.

## Criar habilidades

Em **Admin → Habilidades**, pesquise por nome, classe ou elemento e filtre por rank. É possível criar, editar, duplicar, exportar e importar uma técnica. A importação abre um rascunho sem o identificador do registro original; confirme em Salvar para cadastrar.

Há seis pontos de partida: Passo da Folha, Arco da Folha, Katon: Brasa Errante, Suiton: Manto da Maré, Fuuton: Corte da Brisa e Iryō: Pulso Restaurador. Ajuste requisitos, energia, precisão, multiplicadores e recarga de acordo com a progressão do servidor. Esses modelos só entram no catálogo após serem salvos pelo administrador.

O campo **Movimento e ambiente** configura a ação, a reação da roupa, a cor do chakra e a duração visual. O teste apresenta movimento, som, efeito e os valores configurados. Dano e cura continuam sendo calculados pelas regras e pelos atributos do combate real.

As sugestões de balanceamento destacam combinações como defesa muito alta sem recarga ou paralisia que dura tanto quanto o cooldown. Elas são heurísticas; o catálogo e o balanceamento de produção ainda precisam ser avaliados com dados reais.

O formato portátil usa `format: "shinobi-skill"`, `version: 1` e um objeto `skill`. A configuração visual fica em `skill.meta.visual`:

```json
{
  "action": "cast",
  "environment": "wind",
  "chakra_color": "#88e6c0",
  "duration_ms": 1100
}
```

Os metadados de cura, genjutsu e requisitos continuam preservados. Os campos visuais são opcionais para técnicas antigas e são registrados no log para que o cliente reproduza a ação executada.

## Tilesets e desempenho

O minigame de limpeza aceita colunas e linhas explícitas do atlas. O carregamento da imagem não muda as posições dos alvos, toques repetidos não pontuam duas vezes e configurações novas com meta impossível são rejeitadas. Imagens indisponíveis recebem um alvo substituto clicável. O treino de shuriken usa coordenadas proporcionais à tela e inclui os pontos do último lançamento.

Sprites estáticos não mantêm temporizadores. Animações seguem seu FPS, param fora da tela e suspendem o avanço em abas ocultas. Artes de até 60 FPS mantêm sua velocidade com amostragem de até 30 atualizações por segundo. Consultas de aparência e dimensões de imagem compartilham cache e requisições em andamento.

O combate pula o histórico já ocorrido ao abrir a janela e remove as esperas fixas de três segundos entre efeitos. Áudio, deslocamento e temporizadores são encerrados ao fechar o diálogo. As opções permitem movimento reduzido, som de combate e reprodução mais rápida, sem alterar turnos ou atributos.

O chat mantém até 80 mensagens, combina histórico e eventos sem duplicação e respeita a leitura de mensagens anteriores. O HUD é montado uma vez por viewport. Consultas periódicas de recuperação ficam inativas em abas ocultas; assinaturas de convite e duelo usam filtros. Os editores administrativos carregam quando a seção correspondente é aberta.

## Validação

Com as dependências do lockfile instaladas:

```sh
npm test
npx tsc --noEmit
npm run build
```

Os testes cobrem sincronização de camadas, cache, atlas e pontuação, fila de combate, identificação de alvos, cura do lado adversário, importação dos seis modelos, histórico de chat e consultas em segundo plano. A compilação ainda pode emitir os avisos das dependências existentes sobre `inputValidator`, chunks grandes e configuração do Nitro; não houve atualização de versões nesta entrega.

A validação autenticada no jogo permanece pendente: equipar com duas contas, executar ataques e cura nos dois lados do PvP, testar os assets reais em PC e celular e medir FPS/latência sob carga. Esta entrega não afirma um ganho percentual de FPS nem valida o catálogo que está no banco de produção.

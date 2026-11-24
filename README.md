# Meu Strava em números

Site pessoal com os treinos do Strava: recordes, treinos recentes, gráficos, calendário de constância, clima, mapa das rotas, equipamento e o plano para a próxima prova. Atualiza sozinho a cada treino registrado (com o aviso do Strava ligado) e, de qualquer forma, três vezes por dia.

São cinco páginas:

- `index.html`: a página principal;
- `provas.html`: todas as provas, ano a ano, com as próximas no topo e a comparação com a edição anterior da mesma prova;
- `evolucao.html`: a evolução das marcas (cada recorde novo, por distância), a previsão para a prova principal, ritmo, frequência cardíaca, distância por batimento e cadência mês a mês, e o resumo de cada ano;
- `atividade.html?id=...`: cada treino, com mapa, altimetria, ritmo e frequência cardíaca ao longo do percurso, parciais e melhores trechos;
- `plano.html`: o plano de treino, com contagem regressiva e o que já foi corrido.

O cabeçalho mostra as páginas; as seções da página principal ficam no botão "Seções" (no celular, tudo fica no botão "Menu"). O Plano só aparece com o plano publicado.

Tudo é HTML, CSS e JavaScript puros, sem `npm` e sem etapa de build. Os dados vêm de um script em Python que usa só a biblioteca padrão.

## Como funciona

```
Strava ──► scripts/sync_strava.py ──► data/site.json, data/rotas.json, data/evolucao.json, data/atividades/*.json ──► páginas
              (GitHub Actions, 3x por dia)
```

| Pasta ou arquivo | O que é | Vai para o GitHub? |
|---|---|---|
| `config/perfil.json` | seus textos: frase, sobre, provas, conquistas, privacidade | sim |
| `config/plano.json` | o plano de treino | sim |
| `data/site.json`, `data/rotas.json`, `data/evolucao.json`, `data/atividades/` | o que o site lê (gerado) | sim |
| `data/cache/` | detalhes, séries (altimetria, ritmo e FC), clima e cidades já baixados, sem coordenadas exatas | sim |
| `data/local/` | lista completa com as rotas sem corte | **não** |
| `.env` | suas chaves do Strava | **não** |

## Primeira vez

1. **Crie o app no Strava** em https://www.strava.com/settings/api
   - Category: Visualizer
   - Website: `http://localhost`
   - Authorization Callback Domain: `localhost`
2. **Autorize** (abre o navegador):
   ```
   python scripts/strava_auth.py
   ```
3. **Baixe seus dados.** Na primeira vez vale pedir muitos detalhes. O Strava libera 100 pedidos a cada 15 minutos, então o script espera sozinho entre um lote e outro; com muitos treinos isso leva umas horas:
   ```
   python scripts/sync_strava.py --max-detalhes 900
   ```
   Os dados de demonstração são apagados automaticamente nessa hora. Os gráficos de altimetria, ritmo e frequência cardíaca de cada treino vêm num pedido à parte: `--max-series` diz quantos treinos buscar por rodada (60 por padrão; os mais novos primeiro). Cada um é pedido uma vez só e fica guardado em `data/cache/series/`.
4. **Veja no navegador:**
   ```
   python -m http.server 8000
   ```
   e abra http://localhost:8000. Abrir o `index.html` direto com dois cliques não funciona: o navegador bloqueia a leitura dos dados.

## Publicar no GitHub Pages

1. Crie um repositório **público** (o Pages grátis exige) e suba esta pasta.
2. Em **Settings → Secrets and variables → Actions**, crie três segredos com os valores do seu `.env`: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` e `STRAVA_REFRESH_TOKEN`.
3. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
4. Em **Actions → Atualizar com o Strava**, clique em **Run workflow**. Depois disso ele roda sozinho às 6h, 13h e 21h.

A cada rodada, o robô guarda os dados novos na `main` com um commit. Antes de mexer no site, faça `git pull`. Se você publicar código enquanto ele roda, ou se dois avisos do Strava chegarem juntos, não tem problema: o robô sempre começa da ponta da `main`. Se a `main` mudar no meio da rodada, ele junta o que chegou e tenta guardar de novo, até 5 vezes. Num conflito dentro de `data/`, valem os dados que ele acabou de gerar. Se a publicação no Pages falhar por um problema do GitHub, ele tenta mais uma vez depois de 20 s.

**Domínio próprio:** crie um arquivo `CNAME` na raiz com o domínio (por exemplo `meusite.com.br`), configure o DNS como o GitHub explica em Settings → Pages e marque "Enforce HTTPS". Depois troque o endereço antigo nas etiquetas `og:image` e `og:url` do começo das três páginas, para a prévia de link usar o domínio novo.

## Atualizar a cada treino

Com o site já publicado, dá para ele se atualizar sozinho 2 a 3 minutos depois de cada atividade nova, editada ou apagada no Strava:

```
Strava ──aviso──► Cloudflare Worker (webhook/worker.js) ──► GitHub Actions ──► site no ar
```

Os horários fixos continuam valendo como rede de segurança.

1. **Token do GitHub.** Em https://github.com/settings/personal-access-tokens/new crie um token *fine-grained*: em "Repository access", escolha só o repositório do site; em "Permissions → Repository permissions", dê **Contents: Read and write**. Anote a data de validade: quando vencer, o site volta a atualizar só nos horários fixos até você trocar o token no Worker.
2. **Senhas da ponte.** No PC:
   ```
   python scripts/strava_webhook.py preparar
   ```
   Ele grava duas senhas no `.env` e mostra o que vai no Worker.
3. **O Worker.** Crie uma conta grátis em https://dash.cloudflare.com. Em **Workers & Pages → Create → Worker**, dê um nome (por exemplo `strava-ponte`) e publique. Depois, em **Edit code**, troque tudo pelo conteúdo de `webhook/worker.js` e clique em **Deploy**. Em **Settings → Variables and Secrets**, crie `CAMINHO_SECRETO`, `STRAVA_VERIFY_TOKEN`, `STRAVA_ATHLETE_ID` e `GITHUB_REPO` (com os valores do passo 2) e `GITHUB_TOKEN` como **Secret**.
4. **Ligue o aviso do Strava** com o endereço do Worker:
   ```
   python scripts/strava_webhook.py criar https://strava-ponte.SEU-USUARIO.workers.dev/strava/CAMINHO_SECRETO
   ```
5. **Teste:** mude o título de uma atividade no Strava. Em **Actions** do GitHub aparece uma rodada nova e, em uns 3 minutos, o site mostra o título novo.

Para conferir ou desligar: `python scripts/strava_webhook.py ver` e `python scripts/strava_webhook.py apagar`. Se algo falhar, o Worker mostra o motivo em **Workers & Pages → strava-ponte → Logs**.

## Personalizar

**`config/perfil.json`**

| Campo | Para quê |
|---|---|
| `nome_site` | o nome grande da abertura e da aba; vazio usa seu nome do Strava |
| `titulo` | como o nome se divide em duas linhas; a segunda fica em destaque. Vazio, a última palavra desce |
| `nome_topo` | o nome curto do cabeçalho; vazio vira "Nome S." |
| `esporte_principal` | `corrida`, `pedal`, `natacao` ou `caminhada`: guia os destaques e as conquistas |
| `frase` | a frase da abertura, uma linha por item. Uma linha entre travessões (`"— assim —"`) fica em destaque, com traços dos lados |
| `fotos` | as duas fotos dos lados do título (no celular, ficam em cima), cada uma com `arquivo` (por exemplo `assets/img/eu.jpg`, com 1000 px de largura) e `descricao` (lida por quem usa leitor de tela). `grande` é opcional: uma versão com 1920 px que só telas largas baixam. Fotos em pé ficam melhor |
| `altimetria_referencia` | a montanha usada para comparar a subida: `nome`, `plural`, `altura_m`, `detalhe` e as coordenadas `lat` e `lng` do cume, que aparecem no mapa de relevo |
| `sobre` | o texto de apresentação, um parágrafo por item. `*assim*` fica em destaque; um parágrafo inteiro entre asteriscos vira a frase grande |
| `assinatura` | nome e cidade que fecham o texto "sobre"; vazio usa o nome do Strava e a cidade onde você mais treina |
| `provas_alvo` | o calendário da temporada (seção "Provas alvo"): `nome`, `data`, `cidade`, `distancia_km`, `prioridade` (`A` principal, `B` secundária, `C` treino), `meta`, `link`, `nota` e `plano: true` na prova que tem o plano de treino. Sem data marcada, use `previsao`: um mês (`"2027-07"`), um semestre (`"2027-S2"`) ou só o ano (`"2027"`). `busca` é um pedaço do nome que a prova costuma ter no Strava (por exemplo `"fogueira"`): o cartão mostra os seus tempos nas edições anteriores e, sem `distancia_km`, a distância da última. Depois da data (ou do período previsto), o tempo vem sozinho do treino do Strava |
| `provas` | provas que não estão no Strava (ou com o tempo oficial), cada uma com `nome`, `data` (`"2025-07-19"`), `tempo` (`"1:42:10"`), `distancia_km` e, se quiser, `strava_id` e `nota`. As marcadas como "Prova" no Strava entram sozinhas, na página Provas e na página principal. Nos recordes de meia maratona e maratona, o tempo da prova vale mesmo quando o GPS marcou um pouco menos que a distância oficial |
| `nao_sao_provas` | ids de treinos marcados como "Prova" no Strava que não devem aparecer como prova (o id é o número no fim do link do treino) |
| `conquistas` | conquistas que os números não mostram (pódio, recorde de clube...) |
| `meta_anual_km` | a meta de quilômetros do ano no esporte principal: um número (`2000`) ou um por ano (`{"2026": 1800, "2027": 2200}`). Vazio, a comparação usa o total do ano anterior |
| `ficha` | linhas a mais na ficha ao lado do "Sobre", cada uma com `rotulo` e `valor` (por exemplo `{"rotulo": "Clube", "valor": "Oceanthief RC"}`). As linhas de sempre (desde quando está no Strava, cidade, melhores tempos e provas) vêm sozinhas |
| `goatcounter` | o código da sua conta no [GoatCounter](https://www.goatcounter.com) (o que vem antes de `.goatcounter.com`). Liga o contador de visitas, que aparece no rodapé. Vazio, nada é contado |
| `secoes` | para trocar o título de uma seção, como `{"recordes": "Meus tempos"}` (em português, traduzido pelo dicionário, ou `{"pt": "...", "en": "...", "es": "..."}`). Com `["Título", "frase"]`, a frase aparece embaixo do título |
| `links` | Instagram e perfil do Strava (o botão "Follow me on Strava" leva a ele) |
| `feito_por` | uma assinatura "Made by: ..." acima do botão do Strava; vazio, não aparece |
| `casa` | `{"lat": -23.5, "lng": -46.6}` se quiser fixar a "casa"; vazio, ela é calculada |
| `privacidade.cortar_inicio_fim_m` | quantos metros do começo e do fim de cada rota esconder, no mínimo (hoje 0: a rota sai inteira; sem o campo, 400) |
| `privacidade.cortar_variacao_m` | quanto esse corte pode crescer, num valor diferente para cada treino (hoje 0; sem o campo, 200, ou seja, de 400 a 600 m) |
| `privacidade.zona_raio_m` | o raio das zonas de privacidade (padrão 1000). Nada do que passa dentro delas aparece no site. Como no Strava, o centro de cada zona fica deslocado do lugar real, numa direção sorteada, para o buraco no mapa não apontar para o endereço |
| `privacidade.zonas_automaticas` | quantas zonas o site cria sozinho nos lugares de onde mais saem treinos (hoje 0; sem o campo, 1, que costuma ser a casa). Mais que 1 pode esconder parques e pistas, que também aparecem muito |
| `privacidade.zonas_extras` | outros lugares para esconder, como `[{"lat": -21.75, "lng": -43.35}]` (trabalho, casa de alguém) |
| `privacidade.ocultar_somente_seguidores` | `true` tira do site os treinos visíveis só para seguidores |

Depois de mudar a privacidade ou `nao_sao_provas`, rode `python scripts/sync_strava.py --so-gerar` para refazer os arquivos.

**`config/plano.json`**: a prova (`nome`, `data`, `cidade`, `link`, `meta`, `meta_pace`; os dois últimos podem ficar de fora), os nomes das fases e as semanas. Com `"rascunho": true`, as semanas ficam escondidas: a página do plano avisa que ele está sendo montado, e a contagem regressiva continua na abertura. Cada semana tem `inicio` (sempre uma segunda-feira), `fase`, `km`, `foco` e `treinos`. Em cada treino, `dia` vai de 0 (segunda) a 6 (domingo) e `chave: true` marca o treino importante da semana.

**Cores:** ficam no começo de `assets/css/site.css`, em `--destaque` (tema escuro e tema claro).

**Ícones e prévia de link:** `assets/img/compartilhar.jpg` (1200 × 630) é a imagem que aparece quando o link é colado no WhatsApp, Instagram ou X. `assets/img/icone-180.png`, `icone-192.png` e `icone-512.png` são o ícone de quem salva o site na tela inicial do celular, descritos em `assets/site.webmanifest`. `icone-strava.png` é o mesmo desenho para o app em https://www.strava.com/settings/api.

## Idiomas

O site existe em português, inglês e espanhol. A troca fica no botão de preferências do cabeçalho (o que mostra PT, EN ou ES), junto com km ou milhas e o tema escuro ou claro; as escolhas ficam guardadas no navegador. Na primeira visita, vale o idioma do navegador (português, inglês ou espanhol; qualquer outro abre em inglês). Para mandar um link já num idioma, acrescente `?lang=en` ou `?lang=es` ao endereço.

- **Textos do site** (títulos, botões, gráficos, dicas): ficam em `assets/js/traducoes.js`. A frase em português é a chave, seguida da versão em inglês e em espanhol. Marcadores como `{n}` ou `{data}` precisam aparecer nas três.
- **Os seus textos** no `perfil.json` e no `plano.json`: qualquer texto pode virar `{"pt": "...", "en": "...", "es": "..."}`, como já estão o `sobre` e as descrições das fotos. Um texto só em português é procurado no dicionário e, se não estiver lá, aparece em português nos três idiomas.
- **Os nomes dos treinos** vêm do Strava e ficam como você escreveu.

Depois de mudar textos, confira se nada ficou sem tradução:

```
python scripts/checar_traducoes.py
```

## Privacidade

- O site pede ao Strava só a permissão `activity:read`. Treinos marcados como "Só eu" e os trechos dentro das zonas de privacidade que você criar no próprio Strava nunca chegam aqui. Para esconder um lugar, o caminho mais simples é criar a zona lá.
- Desde 24/11/2026 as rotas saem inteiras, como vêm do Strava, inclusive perto de casa (antes, o site cortava de 400 a 600 m de cada ponta e escondia 1 km em volta da casa). Para voltar a esconder, mude os campos `privacidade` acima e rode `python scripts/sync_strava.py --so-gerar`; a página de cada treino passa a avisar quando a rota foi cortada.
- As cidades e os pontos do mapa geral são arredondados.

## Ver com dados de mentira

```
python scripts/gerar_demo.py
```

Cria uns 2.300 treinos falsos para testar o visual. A primeira sincronização de verdade apaga tudo.

## Créditos

Dados do [Strava](https://www.strava.com). Mapas © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), com [Leaflet](https://leafletjs.com); relevo do [OpenTopoMap](https://opentopomap.org). Globos com [d3-geo](https://d3js.org/d3-geo) e o contorno dos continentes do [Natural Earth](https://www.naturalearthdata.com) (pacote world-atlas). Clima do [Open-Meteo](https://open-meteo.com). Cidades pelo Nominatim (OpenStreetMap). Fontes: [Forum](https://fonts.google.com/specimen/Forum) e [Manrope](https://fonts.google.com/specimen/Manrope). Visitas contadas pelo [GoatCounter](https://www.goatcounter.com), sem cookies.

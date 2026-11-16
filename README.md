# Meu Strava em números

Site pessoal com os treinos do Strava: recordes, treinos recentes, gráficos, calendário de constância, clima, mapa das rotas, equipamento e o plano para a próxima prova. Atualiza sozinho a cada treino registrado (com o aviso do Strava ligado) e, de qualquer forma, três vezes por dia.

São três páginas:

- `index.html`: a página principal;
- `atividade.html?id=...`: cada treino, com mapa, parciais e melhores trechos;
- `plano.html`: o plano de treino, com contagem regressiva e o que já foi corrido.

Tudo é HTML, CSS e JavaScript puros, sem `npm` e sem etapa de build. Os dados vêm de um script em Python que usa só a biblioteca padrão.

## Como funciona

```
Strava ──► scripts/sync_strava.py ──► data/site.json, data/rotas.json, data/atividades/*.json ──► páginas
              (GitHub Actions, 3x por dia)
```

| Pasta ou arquivo | O que é | Vai para o GitHub? |
|---|---|---|
| `config/perfil.json` | seus textos: frase, sobre, provas, conquistas, privacidade | sim |
| `config/plano.json` | o plano de treino | sim |
| `data/site.json`, `data/rotas.json`, `data/atividades/` | o que o site lê (gerado) | sim |
| `data/cache/` | detalhes, clima e cidades já baixados, sem coordenadas exatas | sim |
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
   Os dados de demonstração são apagados automaticamente nessa hora.
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

**Domínio próprio:** crie um arquivo `CNAME` na raiz com o domínio (por exemplo `meusite.com.br`), configure o DNS como o GitHub explica em Settings → Pages e marque "Enforce HTTPS".

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
| `fotos` | as duas fotos dos lados do título (no celular, ficam em cima), cada uma com `arquivo` (por exemplo `assets/img/eu.jpg`) e `descricao` (lida por quem usa leitor de tela). Fotos em pé ficam melhor; até 1000 px de largura bastam |
| `altimetria_referencia` | a montanha usada para comparar a subida: `nome`, `plural`, `altura_m`, `detalhe` e as coordenadas `lat` e `lng` do cume, que aparecem no mapa de relevo |
| `sobre` | o texto de apresentação, um parágrafo por item. `*assim*` fica em destaque; um parágrafo inteiro entre asteriscos vira a frase grande |
| `assinatura` | nome e cidade que fecham o texto "sobre"; vazio usa o nome do Strava e a cidade onde você mais treina |
| `provas` | provas com tempo oficial; as marcadas como "Prova" no Strava entram sozinhas |
| `nao_sao_provas` | ids de treinos marcados como "Prova" no Strava que não devem aparecer como prova (o id é o número no fim do link do treino) |
| `conquistas` | conquistas que os números não mostram (pódio, recorde de clube...) |
| `secoes` | título e frase de cada seção |
| `links` | Instagram e perfil do Strava (o botão "Follow me on Strava" leva a ele) |
| `feito_por` | uma assinatura "Made by: ..." acima do botão do Strava; vazio, não aparece |
| `casa` | `{"lat": -23.5, "lng": -46.6}` se quiser fixar a "casa"; vazio, ela é calculada |
| `privacidade.cortar_inicio_fim_m` | quantos metros do começo e do fim de cada rota esconder (padrão 400) |
| `privacidade.ocultar_somente_seguidores` | `true` tira do site os treinos visíveis só para seguidores |

Depois de mudar a privacidade ou `nao_sao_provas`, rode `python scripts/sync_strava.py --so-gerar` para refazer os arquivos.

**`config/plano.json`**: a prova (`nome`, `data`, `cidade`, `link`, `meta`, `meta_pace`; os dois últimos podem ficar de fora), os nomes das fases e as semanas. Cada semana tem `inicio` (sempre uma segunda-feira), `fase`, `km`, `foco` e `treinos`. Em cada treino, `dia` vai de 0 (segunda) a 6 (domingo) e `chave: true` marca o treino importante da semana.

**Cores:** ficam no começo de `assets/css/site.css`, em `--destaque` (tema escuro e tema claro).

## Privacidade

- O site pede ao Strava só a permissão `activity:read`. Treinos marcados como "Só eu" e os trechos dentro das suas zonas de privacidade nunca chegam aqui.
- Além disso, o começo e o fim de cada rota são cortados (400 m por padrão) antes de publicar.
- As cidades e os pontos do mapa geral são arredondados.

## Ver com dados de mentira

```
python scripts/gerar_demo.py
```

Cria uns 2.300 treinos falsos para testar o visual. A primeira sincronização de verdade apaga tudo.

## Créditos

Dados do [Strava](https://www.strava.com). Mapas © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), com [Leaflet](https://leafletjs.com); relevo do [OpenTopoMap](https://opentopomap.org). Globos com [d3-geo](https://d3js.org/d3-geo) e o contorno dos continentes do [Natural Earth](https://www.naturalearthdata.com) (pacote world-atlas). Clima do [Open-Meteo](https://open-meteo.com). Cidades pelo Nominatim (OpenStreetMap). Fonte: [Archivo](https://fonts.google.com/specimen/Archivo).

// Página "O ano em pontos": a história "cada quilômetro, um ponto" (o desenho e os capítulos ficam em pontos.js).
import { $, buscarJSON, carregarTudo, esc, montarRodape, montarTopo, nomeSite, nomeTopo, t } from "./comum.js";
import { montarPontos } from "./pontos.js";

const raiz = $("#pagina-pontos");
try {
  const { site, perfil, plano } = await carregarTudo();
  const [pontos, rotas, evolucao] = await Promise.all([
    buscarJSON("data/pontos.json", true),
    buscarJSON("data/rotas.json", true),
    buscarJSON("data/evolucao.json", true),
  ]);
  document.title = t("Cada quilômetro, um ponto: {nome}", { nome: nomeSite(site, perfil) });
  montarTopo({ nome: nomeTopo(site, perfil), pagina: "pontos", plano: plano?.semanas?.length > 0 });
  montarRodape(site, perfil);
  raiz.innerHTML = `
    <header class="pagina-cabeca"><h1>${esc(t("Cada quilômetro, um ponto"))}</h1></header>
    <section class="secao secao-pagina" id="pontos-km" aria-label="${esc(t("Cada quilômetro, um ponto"))}"><div id="pontos"></div></section>`;
  if (!pontos?.anos || !Object.keys(pontos.anos).length) {
    $("#pontos").innerHTML = `<p class="vazio">${esc(t("Nenhum treino ainda"))}</p>`;
  } else {
    montarPontos($("#pontos"), {
      atividades: site.atividades.filter((a) => a.grupo === "corrida"),
      pontos,
      rotas: new Map(rotas || []),
      perfil,
      evolucao,
    });
  }
} catch (erro) {
  raiz.innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
}

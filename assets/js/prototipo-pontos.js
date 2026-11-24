// Página de teste da seção "Cada quilômetro, um ponto" (fica fora do site publicado).
import { $, buscarJSON, carregarTudo, esc, montarRodape, montarTopo, nomeTopo } from "./comum.js";
import { montarPontos } from "./pontos.js";

try {
  const { site, perfil, plano } = await carregarTudo();
  const [pontos, rotas, evolucao] = await Promise.all([
    buscarJSON("data/pontos.json"),
    buscarJSON("data/rotas.json", true),
    buscarJSON("data/evolucao.json", true),
  ]);
  montarTopo({ nome: nomeTopo(site, perfil), plano: plano?.semanas?.length > 0 });
  montarRodape(site, perfil);
  montarPontos($("#pontos"), {
    atividades: site.atividades.filter((a) => a.grupo === "corrida"),
    pontos,
    rotas: new Map(rotas || []),
    perfil,
    evolucao,
  });
} catch (erro) {
  $("#pontos").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
}

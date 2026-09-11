const API = (() => {
  const { hostname } = window.location;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return '/api';
})();

// ── AUTH ─────────────────────────────────────────────
let usuario = null;
try {
  usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
} catch {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("cf_token");
}
if (!usuario || typeof usuario.nome !== "string") {
  window.location.href = "login.html";
  usuario = { nome: "" };
}

function getToken() {
  return localStorage.getItem("cf_token") || "";
}
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() };
}

document.getElementById("logado").textContent    = usuario.nome;
document.getElementById("userAvatar").textContent = usuario.nome.charAt(0).toUpperCase();

function sair() {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("cf_token");
  window.location.href = "login.html";
}

// ── NAVEGAÇÃO ─────────────────────────────────────────
function showSection(id, navItem) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const section = document.getElementById("sec-" + id);
  if (!section) return;
  section.classList.add("active");
  if (navItem) navItem.classList.add("active");
}

// ── MOEDA ─────────────────────────────────────────────
function formatBRL(v) {
  const value = Number(v);
  return (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mascaraValor(input) {
  let v = input.value.replace(/\D/g, "");
  input.value = (parseInt(v || "0") / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseBRL(str) {
  return parseFloat(String(str).replace(/\./g, "").replace(",", "."));
}

function escapeHtml(value) {
  const text = String(value ?? "");
  return text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addMonthsKeepingDay(date, months) {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, tipo = "success") {
  const t = document.createElement("div");
  t.className = "toast toast-" + tipo;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 350); }, 3000);
}

// ── ESTADO ────────────────────────────────────────────
let dados        = [];
let grafico      = null;
let graficoCat   = null;
let editandoId   = null;
let faturaOffset = 0; // 0 = mês atual, -1 = mês anterior, etc.

// ── PARCELAS ──────────────────────────────────────────
function toggleParcelas() {
  const tipo = document.getElementById("tipo").value;
  const wrap = document.getElementById("parcelas-wrap");
  wrap.style.display = tipo === "parcelado" ? "block" : "none";
  if (tipo !== "parcelado") document.getElementById("parcelas").value = "";
}

// ── SALVAR / EDITAR ───────────────────────────────────
async function salvar() {
  const tipo       = document.getElementById("tipo").value;
  const desc       = document.getElementById("desc").value.trim();
  const cat        = document.getElementById("cat").value.trim();
  const pessoa     = document.getElementById("pessoa").value.trim();
  const valorTotal = parseBRL(document.getElementById("valor").value);
  const data       = document.getElementById("data").value;
  const erroEl     = document.getElementById("form-erro");

  erroEl.textContent = "";
  if (!desc || !cat || !data)          { erroEl.textContent = "Preencha todos os campos obrigatórios."; return; }
  if (isNaN(valorTotal) || valorTotal <= 0) { erroEl.textContent = "Informe um valor válido maior que zero."; return; }

  // MODO EDIÇÃO
  if (editandoId) {
    try {
      const res = await fetch(`${API}/movimentacoes/${editandoId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ tipo, descricao: desc, categoria: cat, pessoa, valor: valorTotal, data })
      });
      if (!res.ok) { const e = await res.json(); erroEl.textContent = e.erro || "Erro ao editar."; return; }
      cancelarEdicao();
      toast("Movimentação atualizada!");
      await atualizar();
    } catch { erroEl.textContent = "Não foi possível conectar ao servidor."; }
    return;
  }

  // MODO CRIAÇÃO
  const registros = [];
  if (tipo !== "parcelado") {
    registros.push({ tipo, desc, cat, pessoa, valor: valorTotal, data });
  } else {
    const parcelas = Number(document.getElementById("parcelas").value);
    if (!parcelas || parcelas < 2) { erroEl.textContent = "Informe o número de parcelas (mínimo 2)."; return; }
    const totalCentavos = Math.round(valorTotal * 100);
    const centavosBase = Math.floor(totalCentavos / parcelas);
    const resto = totalCentavos % parcelas;
    const dataInicial = parseDateInput(data);
    for (let i = 0; i < parcelas; i++) {
      const d = addMonthsKeepingDay(dataInicial, i);
      const valorParcela = (centavosBase + (i < resto ? 1 : 0)) / 100;
      registros.push({ tipo: "gasto", desc: `${desc} (${i+1}/${parcelas})`, cat, pessoa, valor: valorParcela, data: formatDateInput(d) });
    }
  }

  try {
    const res = await fetch(`${API}/movimentacoes/lote`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        movimentacoes: registros.map((reg) => ({
          tipo: reg.tipo,
          descricao: reg.desc,
          categoria: reg.cat,
          pessoa: reg.pessoa,
          valor: reg.valor,
          data: reg.data,
        })),
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      erroEl.textContent = e.erro || "Erro ao salvar.";
      return;
    }
    limpar();
    toast("Movimentação salva!");
    await atualizar();
  } catch { erroEl.textContent = "Não foi possível conectar ao servidor."; }
}

function editarMovimentacao(id) {
  const d = dados.find(x => x.id === id);
  if (!d) return;

  editandoId = id;
  document.getElementById("tipo").value   = d.tipo === "gasto" ? "gasto" : d.tipo;
  document.getElementById("desc").value   = d.descricao;
  document.getElementById("cat").value    = d.categoria || "";
  document.getElementById("pessoa").value = d.pessoa || "";
  document.getElementById("valor").value  = formatBRL(d.valor);
  document.getElementById("data").value   = d.data;
  toggleParcelas();

  document.getElementById("form-titulo").textContent  = "Editar Movimentação";
  document.getElementById("btn-salvar").textContent   = "Salvar alterações";
  document.getElementById("btn-cancelar").style.display = "inline-flex";

  // navega para o form
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("sec-nova").classList.add("active");
  document.querySelector(".nav-item[onclick*='nova']").classList.add("active");
}

function cancelarEdicao() {
  editandoId = null;
  document.getElementById("form-titulo").textContent    = "Nova Movimentação";
  document.getElementById("btn-salvar").textContent     = "Salvar movimentação";
  document.getElementById("btn-cancelar").style.display = "none";
  limpar();
}

// ── ATUALIZAR ─────────────────────────────────────────
async function atualizar() {
  try {
    const res = await fetch(`${API}/movimentacoes`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) sair();
      throw new Error(`Falha ao buscar movimentações: ${res.status}`);
    }
    dados = await res.json();
    window.dados = dados;
  } catch (error) {
    console.error(error);
    dados = [];
    window.dados = dados;
    return false;
  }

  renderLista();
  renderResumo();
  atualizarGrafico();
  await atualizarGraficoCategorias();
  atualizarFaturaMes();
  return true;
}

// ── LISTA DE MOVIMENTAÇÕES ────────────────────────────
function renderLista() {
  const filtroTipo = document.getElementById("filtro-tipo")?.value || "todos";
  const filtroPessoa = (document.getElementById("filtro-pessoa")?.value || "").toLowerCase().trim();
  const filtroMes  = document.getElementById("filtro-mes")?.value || "";

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  const filtrados = dados.filter(d => {
    if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
    if (filtroPessoa && !(d.pessoa || "").toLowerCase().includes(filtroPessoa)) return false;
    if (filtroMes && !d.data.startsWith(filtroMes)) return false;
    return true;
  });

  filtrados.forEach(d => {
    const li = document.createElement("li");
    li.dataset.id = d.id;
    li.innerHTML = `
      <label class="mov-check">
        <input type="checkbox" onchange="toggleSelecao(this)" value="${d.id}" />
        <span class="checkmark"></span>
      </label>
      <span>${d.pessoa ? "<strong>" + escapeHtml(d.pessoa) + "</strong> · " : ""}${escapeHtml(d.descricao)}
        <em style="color:var(--muted);font-size:11px">${d.categoria ? " · " + escapeHtml(d.categoria) : ""} (${escapeHtml(d.tipo)})</em>
      </span>
      <span class="mov-valor ${d.tipo === 'receita' ? 'verde' : 'vermelho'}">R$ ${formatBRL(d.valor)}</span>
      <button class="btn-edit" onclick="editarMovimentacao(${d.id})" title="Editar">✎</button>
      <button class="btn-del"  onclick="remover(${d.id})" title="Remover">✕</button>
    `;
    lista.appendChild(li);
  });

  document.getElementById("lista-empty").style.display   = filtrados.length === 0 ? "block" : "none";
  document.getElementById("mov-toolbar").style.display   = dados.length > 0 ? "flex" : "none";
  document.getElementById("sel-count").style.visibility  = "hidden";
}

// ── RESUMO ────────────────────────────────────────────
function renderResumo() {
  let receitas = 0, gastos = 0;
  dados.forEach(d => d.tipo === "receita" ? (receitas += parseFloat(d.valor)) : (gastos += parseFloat(d.valor)));
  document.getElementById("r").textContent = formatBRL(receitas);
  document.getElementById("g").textContent = formatBRL(gastos);
  document.getElementById("s").textContent = formatBRL(receitas - gastos);
}

// ── FATURA NAVEGÁVEL ──────────────────────────────────
function mudarMesFatura(delta) {
  faturaOffset += delta;
  atualizarFaturaMes();
}

function atualizarFaturaMes() {
  const lista     = document.getElementById("faturaMes");
  const totalSpan = document.getElementById("totalMes");
  const labelMes  = document.getElementById("fatura-mes-label");

  lista.innerHTML = "";
  let total = 0;

  // Usa dia 1 para evitar bug de overflow (ex: 31 de março + 1 mês = 1 de maio)
  const ref = new Date();
  const ano = new Date(ref.getFullYear(), ref.getMonth() + faturaOffset, 1).getFullYear();
  const mes = new Date(ref.getFullYear(), ref.getMonth() + faturaOffset, 1).getMonth(); // 0-11

  const nomesMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  if (labelMes) labelMes.textContent = `${nomesMes[mes]} ${ano}`;

  dados.forEach(d => {
    if (d.tipo === "receita") return;
    const partes = String(d.data).substring(0, 10).split("-").map(Number);
    const anoD = partes[0];
    const mesD = partes[1]; // 1-12
    const diaD = partes[2];

    if (anoD === ano && mesD === mes + 1) {
      total += parseFloat(d.valor);
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${d.pessoa ? "<strong>" + escapeHtml(d.pessoa) + "</strong> · " : ""}${escapeHtml(d.descricao)}
          <em style="color:var(--muted);font-size:11px">(dia ${String(diaD).padStart(2,"0")})</em>
        </span>
        <strong style="color:var(--red);white-space:nowrap;flex-shrink:0">R$ ${formatBRL(d.valor)}</strong>
      `;
      lista.appendChild(li);
    }
  });

  document.getElementById("fatura-empty").style.display = lista.children.length === 0 ? "block" : "none";
  totalSpan.textContent = formatBRL(total);
}

// ── GRÁFICO DOUGHNUT ──────────────────────────────────
function atualizarGrafico() {
  let receitas = 0, gastos = 0;
  dados.forEach(d => d.tipo === "receita" ? (receitas += parseFloat(d.valor)) : (gastos += parseFloat(d.valor)));

  if (grafico) grafico.destroy();
  grafico = new Chart(document.getElementById("grafico"), {
    type: "doughnut",
    data: {
      labels: ["Receitas", "Gastos"],
      datasets: [{ data: [receitas, gastos], backgroundColor: ["#34d399","#f87171"], borderColor: ["#1a1d2e","#1a1d2e"], borderWidth: 3 }]
    },
    options: {
      cutout: "65%",
      plugins: { legend: { position: "bottom", labels: { color: "#9ca3af", font: { family: "'Plus Jakarta Sans', sans-serif", size: 13 }, padding: 20, usePointStyle: true, pointStyleWidth: 10 } } }
    }
  });
}

// ── GRÁFICO CATEGORIAS ────────────────────────────────
async function atualizarGraficoCategorias() {
  try {
    const res  = await fetch(`${API}/categorias`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) sair();
      throw new Error(`Falha ao buscar categorias: ${res.status}`);
    }
    const cats = await res.json();

    if (graficoCat) graficoCat.destroy();
    if (!cats.length) return;

    const cores = ["#3a86ff","#8b5cf6","#06d6a0","#f87171","#fbbf24","#34d399","#f472b6","#60a5fa","#a78bfa","#fb923c"];

    graficoCat = new Chart(document.getElementById("grafico-cat"), {
      type: "bar",
      data: {
        labels: cats.map(c => c.categoria),
        datasets: [{
          label: "Gastos por categoria",
          data: cats.map(c => parseFloat(c.total)),
          backgroundColor: cats.map((_, i) => cores[i % cores.length]),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#6b7280", callback: v => "R$ " + formatBRL(v) }, grid: { color: "#2a2d3e" } },
          y: { ticks: { color: "#e5e7eb" }, grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error("Erro ao carregar categorias:", error);
  }
}

// ── REMOÇÃO ───────────────────────────────────────────
async function remover(id) { await deletarIds([id]); }

async function removerTudo() {
  if (!dados.length) return;
  await deletarIds(dados.map(d => d.id));
}

async function removerSelecionados() {
  const ids = Array.from(document.querySelectorAll("#lista input[type=checkbox]:checked")).map(c => Number(c.value));
  if (!ids.length) return;
  await deletarIds(ids);
}

async function deletarIds(ids) {
  try {
    const respostas = await Promise.all(ids.map(id => fetch(`${API}/movimentacoes/${id}`, { method: "DELETE", headers: authHeaders() })));
    const falhas = respostas.filter((res) => !res.ok);
    if (falhas.length) {
      if (falhas.some((res) => res.status === 401 || res.status === 403)) sair();
      throw new Error("Uma ou mais movimentações não puderam ser removidas.");
    }
    toast(ids.length > 1 ? `${ids.length} movimentações removidas.` : "Movimentação removida.", "error");
    await atualizar();
  } catch { toast("Erro ao remover.", "error"); }
}

// ── SELEÇÃO ───────────────────────────────────────────
function toggleSelecao(checkbox) {
  checkbox.closest("li").classList.toggle("selected", checkbox.checked);
  const sel   = document.querySelectorAll("#lista input[type=checkbox]:checked");
  const count = document.getElementById("sel-count");
  count.style.visibility = sel.length > 0 ? "visible" : "hidden";
  if (sel.length) count.textContent = sel.length + " selecionado" + (sel.length > 1 ? "s" : "");
}

// ── FILTROS ───────────────────────────────────────────
function aplicarFiltros() { renderLista(); }

function limparFiltros() {
  document.getElementById("filtro-tipo").value   = "todos";
  document.getElementById("filtro-pessoa").value = "";
  document.getElementById("filtro-mes").value    = "";
  renderLista();
}

// ── EXPORTAR CSV ──────────────────────────────────────
function exportarCSV() {
  fetch(`${API}/exportar`, { headers: { Authorization: "Bearer " + getToken() } })
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) sair();
        throw new Error("Não foi possível exportar.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "movimentacoes.csv";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => toast("Erro ao exportar.", "error"));
}

// ── LIMPAR FORM ───────────────────────────────────────
function limpar() {
  ["desc","cat","pessoa","valor","parcelas","data"].forEach(id => document.getElementById(id).value = "");
}

// ── RECONEXÃO ─────────────────────────────────────────
let intervaloReconexao = null;

async function tentarConectar() {
  const ok = await atualizar();
  setStatus(ok ? "online" : "offline");
  if (!ok && !intervaloReconexao) {
    intervaloReconexao = setInterval(async () => {
      if (await atualizar()) {
        clearInterval(intervaloReconexao);
        intervaloReconexao = null;
        setStatus("online");
      }
    }, 3000);
  }
}

function setStatus(estado) {
  const dot  = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  if (!dot) return;
  dot.className    = "status-dot " + estado;
  text.textContent = estado === "online" ? "Conectado" : "Sem conexão...";
}

// ── INIT ──────────────────────────────────────────────
window.onload = async function () {
  toggleParcelas();
  await tentarConectar();
};

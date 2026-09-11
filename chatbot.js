(() => {
  const panel = document.getElementById("chatbotPanel");
  const messages = document.getElementById("chatbotMessages");
  const input = document.getElementById("chatbotInput");
  const form = document.getElementById("chatbotForm");

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function addMessage(text, author) {
    const message = document.createElement("div");
    message.className = `chatbot-message ${author}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function answer(question) {
    const text = question.toLowerCase();
    const items = Array.isArray(window.dados) ? window.dados : [];
    const expenses = items.filter((item) => item.tipo !== "receita");
    const income = items.filter((item) => item.tipo === "receita");
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const totalIncome = income.reduce((sum, item) => sum + Number(item.valor || 0), 0);

    if (text.includes("ajuda") || text.includes("o que você")) {
      return "Posso informar seu saldo, total de gastos, receitas, maior despesa e gastos por categoria.";
    }
    if (text.includes("saldo")) {
      return `Seu saldo é ${money(totalIncome - totalExpenses)} (${money(totalIncome)} em receitas e ${money(totalExpenses)} em gastos).`;
    }
    if (text.includes("receita") || text.includes("ganhei")) {
      return `Você registrou ${money(totalIncome)} em receitas.`;
    }
    if (text.includes("maior") || text.includes("mais gastei")) {
      const biggest = expenses.reduce((current, item) => Number(item.valor) > Number(current?.valor || 0) ? item : current, null);
      return biggest
        ? `Sua maior despesa foi "${biggest.descricao}" no valor de ${money(biggest.valor)}.`
        : "Ainda não encontrei despesas registradas.";
    }
    if (text.includes("categoria")) {
      const totals = {};
      expenses.forEach((item) => {
        const category = item.categoria || "Sem categoria";
        totals[category] = (totals[category] || 0) + Number(item.valor || 0);
      });
      const ranking = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return ranking.length
        ? `Gastos por categoria:\n${ranking.map(([category, total]) => `• ${category}: ${money(total)}`).join("\n")}`
        : "Ainda não encontrei gastos por categoria.";
    }
    if (text.includes("gasto") || text.includes("despesa")) {
      return `Você registrou ${money(totalExpenses)} em gastos.`;
    }
    return "Não entendi. Tente perguntar: “qual meu saldo?”, “quanto gastei?” ou “qual foi meu maior gasto?”.";
  }

  document.getElementById("chatbotToggle").addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  });
  document.getElementById("chatbotClose").addEventListener("click", () => panel.classList.remove("open"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, "user");
    addMessage(answer(question), "bot");
    input.value = "";
  });

  addMessage("Olá! Posso analisar suas movimentações. Pergunte sobre saldo, gastos ou receitas.", "bot");
})();

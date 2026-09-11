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

  async function askAssistant(question) {
    const response = await fetch(`${API}/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message: question }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || "Não foi possível consultar o assistente.");
    return data.resposta;
  }

  document.getElementById("chatbotToggle").addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  });
  document.getElementById("chatbotClose").addEventListener("click", () => panel.classList.remove("open"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, "user");
    input.value = "";
    try {
      addMessage(await askAssistant(question), "bot");
    } catch (error) {
      console.error(error);
      addMessage(error.message, "bot");
    }
  });

  addMessage("Olá! Posso analisar suas movimentações. Pergunte sobre saldo, gastos ou receitas.", "bot");
})();

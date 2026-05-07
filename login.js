const API = "https://controle-de-gastos-v4z4.onrender.com";

// Se já estiver logado, redireciona direto
if (localStorage.getItem("usuarioLogado")) {
  window.location.href = "index.html";
}

/* ── SWITCH ENTRE LOGIN E CADASTRO ── */
const wrapper   = document.getElementById('authWrapper');
const cLogin    = document.getElementById('cardLogin');
const cRegister = document.getElementById('cardRegister');
const cdot0     = document.getElementById('cdot0');
const cdot1     = document.getElementById('cdot1');

let current = 'login';
let locked  = false;

function isMobile() {
  return window.innerWidth <= 767;
}

function switchTo(mode) {
  if (mode === current || locked) return;
  locked  = true;
  current = mode;

  if (mode === 'register') {
    if (!isMobile()) wrapper.classList.add('to-register');
    cdot0.classList.remove('on');
    cdot1.classList.add('on');
    setTimeout(() => {
      cLogin.classList.add('hidden');
      cRegister.classList.remove('hidden');
      locked = false;
    }, isMobile() ? 0 : 300);
  } else {
    if (!isMobile()) wrapper.classList.remove('to-register');
    cdot1.classList.remove('on');
    cdot0.classList.add('on');
    setTimeout(() => {
      cRegister.classList.add('hidden');
      cLogin.classList.remove('hidden');
      locked = false;
    }, isMobile() ? 0 : 300);
  }

  // Limpar erros ao trocar de tela
  document.getElementById("login-erro").textContent = "";
  document.getElementById("reg-erro").textContent = "";
}

/* Reaplica estado correto ao redimensionar */
window.addEventListener('resize', () => {
  if (!isMobile()) {
    if (current === 'register') {
      wrapper.classList.add('to-register');
    } else {
      wrapper.classList.remove('to-register');
    }
  } else {
    wrapper.classList.remove('to-register');
  }
});

/* ── LOGIN ── */
async function entrar() {
  const user   = document.getElementById("login-user").value.trim();
  const senha  = document.getElementById("login-senha").value.trim();
  const erroEl = document.getElementById("login-erro");

  erroEl.style.color = "#f87171";
  erroEl.textContent = "";

  if (!user || !senha) {
    erroEl.textContent = "Preencha usuário e senha.";
    return;
  }

  try {
    const res  = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, senha })
    });

    const data = await res.json();

    if (!res.ok) {
      erroEl.textContent = data.erro || "Usuário ou senha inválidos.";
      return;
    }

    localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));
    localStorage.setItem("cf_token", data.token);

    // Mostrar loading antes de redirecionar
    showLoading(() => {
      window.location.href = "index.html";
    });

  } catch (err) {
    erroEl.textContent = "Não foi possível conectar ao servidor.";
    console.error(err);
  }
}

/* ── LOADING ── */
function showLoading(callback) {
  const overlay = document.getElementById("loadingOverlay");
  overlay.classList.add("active");
  // Aguarda a animação aparecer (350ms) e redireciona
  setTimeout(callback, 1400);
}

/* ── CADASTRO ── */
async function cadastrar() {
  const nome   = document.getElementById("reg-nome").value.trim();
  const user   = document.getElementById("reg-user").value.trim();
  const senha  = document.getElementById("reg-senha").value.trim();
  const erroEl = document.getElementById("reg-erro");

  erroEl.style.color = "#f87171";
  erroEl.textContent = "";

  if (!nome || !user || !senha) {
    erroEl.textContent = "Preencha todos os campos.";
    return;
  }
  if (senha.length < 4) {
    erroEl.textContent = "A senha deve ter no mínimo 4 caracteres.";
    return;
  }

  try {
    const res  = await fetch("http://localhost:3000/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, user, senha })
    });

    const data = await res.json();

    if (!res.ok) {
      erroEl.textContent = data.erro || "Erro ao criar conta.";
      return;
    }

    // Após cadastro, vai para login com mensagem de sucesso
    switchTo("login");
    setTimeout(() => {
      const loginErro = document.getElementById("login-erro");
      loginErro.style.color = "#34d399";
      loginErro.textContent = "Conta criada! Faça login.";
    }, 350);

  } catch (err) {
    erroEl.textContent = "Não foi possível conectar ao servidor.";
    console.error(err);
  }
}

/* ── ENTER NOS CAMPOS ── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-senha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") entrar();
  });
  document.getElementById("reg-senha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") cadastrar();
  });
});

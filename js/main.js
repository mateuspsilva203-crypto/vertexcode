// ===== Configuração =====
// Número no formato internacional, só dígitos: 55 + DDD + número
const WHATSAPP_NUMBER = "5535998286500";
const MENSAGEM_PADRAO = "Olá! Gostaria de fazer um orçamento do Vertex Code.";

// Endereço da API que grava no banco.
// "" = mesmo servidor que entrega o site (npm start). Se hospedar a API
// em outro domínio, use a URL completa, ex.: "https://api.seudominio.com.br"
const API_URL = "";

function linkWhatsApp(mensagem) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
}

// ===== Todos os botões/links com data-whatsapp abrem o WhatsApp =====
document.querySelectorAll("[data-whatsapp]").forEach((el) => {
  el.setAttribute("href", linkWhatsApp(MENSAGEM_PADRAO));
  el.setAttribute("target", "_blank");
  el.setAttribute("rel", "noopener");
});

// ===== Formulário =====
const form = document.getElementById("form-orcamento");
if (form) {
  const nota = document.getElementById("form-note");
  const botao = form.querySelector("button[type=submit]");
  const botaoTexto = document.getElementById("btn-texto");
  const notaOriginal = nota.textContent;

  // Máscara simples de telefone brasileiro
  form.contato.addEventListener("input", () => {
    const d = form.contato.value.replace(/\D/g, "").slice(0, 11);
    let v = d;
    if (d.length > 6) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    else if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    else if (d.length > 0) v = `(${d}`;
    form.contato.value = v;
  });

  const erro = (campo, msg) => {
    campo.classList.add("is-error");
    nota.textContent = msg;
    nota.classList.add("is-error");
    campo.focus();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      nome: form.nome.value.trim(),
      empresa: form.empresa.value.trim(),
      contato: form.contato.value.trim(),
      email: form.email.value.trim(),
      website: form.website.value, // isca anti-robô
    };

    [form.nome, form.empresa, form.contato, form.email].forEach((c) => c.classList.remove("is-error"));
    nota.classList.remove("is-error");
    nota.textContent = notaOriginal;

    if (!dados.nome) return erro(form.nome, "Informe seu nome.");
    if (!dados.empresa) return erro(form.empresa, "Informe o nome da sua empresa.");
    if (dados.contato.replace(/\D/g, "").length < 10) return erro(form.contato, "Informe um telefone válido com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dados.email)) return erro(form.email, "Informe um e-mail válido.");

    botao.disabled = true;
    botaoTexto.textContent = "Enviando...";

    // Abre a aba já no clique (evita bloqueio de pop-up) e redireciona depois
    const aba = window.open("about:blank", "_blank");

    // 1) Grava no banco. Se falhar, o cliente ainda segue para o WhatsApp.
    try {
      const resp = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
    } catch (err) {
      console.error("Não foi possível salvar o lead:", err);
    }

    // 2) Vai para o WhatsApp com os dados
    const mensagem =
      `Olá! Meu nome é ${dados.nome}, da empresa ${dados.empresa}. ` +
      `Gostaria de fazer um orçamento do Vertex Code.\n` +
      `Contato: ${dados.contato}\nE-mail: ${dados.email}`;
    const url = linkWhatsApp(mensagem);
    if (aba) aba.location.href = url; else window.location.href = url;

    form.reset();
    botao.disabled = false;
    botaoTexto.textContent = "Quero meu orçamento";
    nota.textContent = "Recebemos seus dados. Continue a conversa no WhatsApp!";
  });
}

// ===== Animação de entrada ao rolar =====
const itens = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-visible");
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  itens.forEach((el) => obs.observe(el));
} else {
  itens.forEach((el) => el.classList.add("is-visible"));
}

// ===== Ano do rodapé =====
const ano = document.getElementById("ano");
if (ano) ano.textContent = new Date().getFullYear();

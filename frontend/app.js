const giftList = document.getElementById("giftList");
const statusEl = document.getElementById("status");
const guestNameInput = document.getElementById("guestName");
const emptyStateEl = document.getElementById("emptyState");
const refreshButton = document.getElementById("refreshButton");

let gifts = [];
let giftSections = [];
let loading = false;

function setStatus(message, type = "") {
  statusEl.textContent = message || "";
  statusEl.className = `status ${type}`.trim();
}

function validName() {
  return guestNameInput.value.trim().length >= 2;
}

function renderGifts() {
  giftList.innerHTML = "";

  if (!gifts.length) {
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  giftSections.forEach((section) => {
    const sectionLi = document.createElement("li");
    sectionLi.className = "section-title";
    sectionLi.textContent = section.title;
    giftList.appendChild(sectionLi);

    section.gifts.forEach((gift) => {
      const li = document.createElement("li");
      li.className = "gift-item";

      const giftName = document.createElement("span");
      giftName.className = "gift-name";
      giftName.textContent = gift;

      const button = document.createElement("button");
      button.className = "reserve-button";
      button.type = "button";
      button.textContent = "Reservar";
      button.disabled = loading;
      button.addEventListener("click", () => reserveGift(gift));

      li.append(giftName, button);
      giftList.appendChild(li);
    });
  });
}

async function loadGifts(showMessage = false) {
  loading = true;
  renderGifts();

  try {
    const response = await fetch("/api/gifts");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao carregar presentes.");
    }

    gifts = data.gifts || [];
    giftSections = data.sections || [
      {
        title: "Presentes disponiveis",
        gifts,
      },
    ];

    giftSections = giftSections.filter(
      (section) => Array.isArray(section.gifts) && section.gifts.length > 0,
    );
    if (showMessage) {
      setStatus("Lista atualizada.", "ok");
    }
  } catch (error) {
    setStatus(
      error.message || "Erro inesperado ao carregar presentes.",
      "error",
    );
  } finally {
    loading = false;
    renderGifts();
  }
}

async function reserveGift(gift) {
  const name = guestNameInput.value.trim();

  if (name.length < 2) {
    setStatus("Digite seu nome antes de reservar.", "warning");
    guestNameInput.focus();
    guestNameInput.select();
    return;
  }

  const confirmReservation = window.confirm(
    `Deseja reservar "${gift}"(${name})?`,
  );

  if (!confirmReservation) {
    setStatus("Reserva cancelada.", "");
    return;
  }

  loading = true;
  setStatus("Reservando presente...", "");
  renderGifts();

  try {
    const response = await fetch("/api/reserve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gift, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel reservar este presente.");
    }

    setStatus("Presente reservado com sucesso.", "ok");
    await loadGifts(false);
  } catch (error) {
    setStatus(
      error.message || "Erro inesperado ao reservar presente.",
      "error",
    );
  } finally {
    loading = false;
    renderGifts();
  }
}

guestNameInput.addEventListener("input", () => {
  renderGifts();
});

refreshButton.addEventListener("click", () => {
  loadGifts(true);
});

loadGifts();
setInterval(() => loadGifts(false), 10000);

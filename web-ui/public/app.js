const apiUrl = window.__CONFIG__?.marketServiceUrl ?? "http://localhost:3000";

const $ = (id) => document.getElementById(id);

const apiEl = $("apiUrl");
const listEl = $("list");
const statusEl = $("status");
const errorEl = $("error");
const addBtn = $("addBtn");
const refreshBtn = $("refreshBtn");
const nameInput = $("name");
const priceInput = $("price");

apiEl.textContent = apiUrl;

function setStatus(msg) {
  statusEl.textContent = msg ?? "";
}
function setError(msg) {
  errorEl.textContent = msg ?? "";
}

function render(items) {
  listEl.innerHTML = "";
  for (const p of items) {
    const li = document.createElement("li");
    li.textContent = `${p.name} — $${Number(p.price).toFixed(2)} (id=${p.id})`;
    listEl.appendChild(li);
  }
}

async function fetchProducts() {
  setError("");
  setStatus("Loading products...");
  const res = await fetch(`${apiUrl}/products`);
  if (!res.ok) {
    throw new Error(`GET /products failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  render(data.items ?? []);
  setStatus(`Loaded ${data.items?.length ?? 0} products.`);
}

async function addProduct() {
  setError("");
  setStatus("Adding product...");
  addBtn.disabled = true;

  const name = nameInput.value;
  const price = Number(priceInput.value);

  const res = await fetch(`${apiUrl}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price })
  });

  addBtn.disabled = false;

  if (!res.ok) {
    throw new Error(`POST /products failed: ${res.status} ${await res.text()}`);
  }

  nameInput.value = "";
  priceInput.value = "";
  await fetchProducts();
}

refreshBtn.addEventListener("click", () => {
  fetchProducts().catch((e) => setError(String(e)));
});

addBtn.addEventListener("click", () => {
  addProduct().catch((e) => setError(String(e)));
});

fetchProducts().catch((e) => setError(String(e)));


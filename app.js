import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const WHATSAPP_NUMBER = "51901738537";

let currentUser = null;

let expenses = [];
let accounts = [];
let incomes = [];
let unsubIncomes = null;

let income = 3500;
let monthlyBudget = 2500;
let savingGoal = 6000;

let selectedMonth = new Date().toISOString().slice(0, 7);

let unsubExpenses = null;
let unsubAccounts = null;

let categoryChart = null;
let trendChart = null;
let typeChart = null;
let incomeExpenseChart = null;

const authScreen = document.getElementById("authScreen");
const appContainer = document.getElementById("app");
const authMessage = document.getElementById("authMessage");

const loginBtn = document.getElementById("loginBtn");
const requestAccountBtn = document.getElementById("requestAccountBtn");
const logoutBtn = document.getElementById("logoutBtn");

const expenseForm = document.getElementById("expenseForm");
const accountForm = document.getElementById("accountForm");
const filterCategory = document.getElementById("filterCategory");
const monthFilter = document.getElementById("monthFilter");

document.getElementById("expenseDate").valueAsDate = new Date();

monthFilter.value = selectedMonth;

window.showSection = showSection;
window.deleteExpense = deleteExpense;
window.toggleAccount = toggleAccount;
window.deleteAccount = deleteAccount;
window.selectMonthFromSummary = selectMonthFromSummary;

loginBtn.addEventListener("click", loginUser);
requestAccountBtn.addEventListener("click", requestAccountByWhatsApp);
logoutBtn.addEventListener("click", logoutUser);

monthFilter.addEventListener("change", () => {
  selectedMonth = monthFilter.value;
  renderAll();
});

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;

    authScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");

    document.getElementById("userEmailText").textContent = user.email;

    await loadSettings();
    await createDefaultDataIfNeeded();

    listenAccounts();
    listenExpenses();
    listenIncomes();

  } else {
    currentUser = null;

    if (unsubExpenses) unsubExpenses();
    if (unsubAccounts) unsubAccounts();

    expenses = [];
    accounts = [];

    appContainer.classList.add("hidden");
    authScreen.classList.remove("hidden");
  }
});

async function loginUser() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();

  if (!email || !password) {
    authMessage.textContent = "Ingresa tu correo y contraseña.";
    return;
  }

  try {
    authMessage.textContent = "Ingresando...";
    await signInWithEmailAndPassword(auth, email, password);
    authMessage.textContent = "";
  } catch (error) {
    authMessage.textContent = "No se pudo iniciar sesión. Revisa tus datos.";
  }
}

function getTotalIncome() {
  return incomes
    .filter(i => i.date?.startsWith(selectedMonth))
    .reduce((total, i) => total + Number(i.amount || 0), 0);
}

function requestAccountByWhatsApp() {
  const email = document.getElementById("authEmail").value.trim();

  const message = `
Hola, quiero crear una cuenta para el dashboard financiero.

Correo: ${email || "No ingresado"}
Por favor, créame un usuario para poder iniciar sesión.
  `.trim();

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

async function logoutUser() {
  await signOut(auth);
}

function userDocRef() {
  return doc(db, "users", currentUser.uid);
}

function settingsDocRef() {
  return doc(db, "users", currentUser.uid, "settings", "main");
}

function accountsCollectionRef() {
  return collection(db, "users", currentUser.uid, "accounts");
}

function expensesCollectionRef() {
  return collection(db, "users", currentUser.uid, "expenses");
}

function incomesCollectionRef() {
  return collection(db, "users", currentUser.uid, "incomes");
}

async function loadSettings() {
  const snap = await getDoc(settingsDocRef());

  if (snap.exists()) {
    const data = snap.data();

    income = Number(data.income) || 3500;
    monthlyBudget = Number(data.monthlyBudget) || 2500;
    savingGoal = Number(data.savingGoal) || 6000;
  } else {
    await setDoc(settingsDocRef(), {
      income,
      monthlyBudget,
      savingGoal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

async function saveSettings() {
  await setDoc(
    settingsDocRef(),
    {
      income,
      monthlyBudget,
      savingGoal,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function createDefaultDataIfNeeded() {
  await setDoc(
    userDocRef(),
    {
      email: currentUser.email,
      uid: currentUser.uid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  const accountsSnapshot = await getDocs(accountsCollectionRef());

  if (accountsSnapshot.empty) {
    await addDoc(accountsCollectionRef(), {
      name: "Efectivo",
      type: "Efectivo",
      balance: 0,
      active: true,
      createdAt: serverTimestamp()
    });
  }
}

function listenAccounts() {
  if (unsubAccounts) unsubAccounts();

  const q = query(accountsCollectionRef(), orderBy("createdAt", "asc"));

  unsubAccounts = onSnapshot(q, snapshot => {
    accounts = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    renderAll();
  });
}

function listenExpenses() {
  if (unsubExpenses) unsubExpenses();

  const q = query(expensesCollectionRef(), orderBy("createdAt", "desc"));

  unsubExpenses = onSnapshot(q, snapshot => {
    expenses = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    renderAll();
  });
}

function listenIncomes() {
  if (unsubIncomes) unsubIncomes();

  const q = query(incomesCollectionRef(), orderBy("createdAt", "desc"));

  unsubIncomes = onSnapshot(q, snapshot => {
    incomes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderAll();
  });
}

function formatMoney(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`;
}

function formatMonthName(monthValue) {
  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric"
  });
}

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(section => {
    section.classList.remove("active-section");
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });

  document.getElementById(sectionId).classList.add("active-section");
  document.querySelector(`[data-section="${sectionId}"]`).classList.add("active");

  if (sectionId === "reportes") {
    setTimeout(renderCharts, 150);
  }
}

function getActiveAccounts() {
  return accounts.filter(account => account.active);
}

function getFilteredExpensesByMonth() {
  return expenses.filter(expense => {
    if (!expense.date) return false;
    return expense.date.startsWith(selectedMonth);
  });
}

function getTotalExpenses() {
  return getFilteredExpensesByMonth().reduce((total, expense) => {
    return total + Number(expense.amount || 0);
  }, 0);
}

function getSaving() {
  return getTotalIncome() - getTotalExpenses();
}

function groupByCategory() {
  const result = {};

  getFilteredExpensesByMonth().forEach(expense => {
    const category = expense.category || "Otros";

    if (!result[category]) {
      result[category] = 0;
    }

    result[category] += Number(expense.amount || 0);
  });

  return result;
}

function groupByType() {
  const result = {};

  getFilteredExpensesByMonth().forEach(expense => {
    const type = expense.type || "Variable";

    if (!result[type]) {
      result[type] = 0;
    }

    result[type] += Number(expense.amount || 0);
  });

  return result;
}

function getTopCategory() {
  const grouped = groupByCategory();
  const entries = Object.entries(grouped);

  if (entries.length === 0) {
    return {
      category: "---",
      amount: 0
    };
  }

  entries.sort((a, b) => b[1] - a[1]);

  return {
    category: entries[0][0],
    amount: entries[0][1]
  };
}

function getMonthlySummary() {
  const summary = {};

  expenses.forEach(expense => {
    if (!expense.date) return;

    const month = expense.date.slice(0, 7);

    if (!summary[month]) {
      summary[month] = {
        month,
        total: 0,
        count: 0,
        categories: {}
      };
    }

    summary[month].total += Number(expense.amount || 0);
    summary[month].count += 1;

    const category = expense.category || "Otros";

    if (!summary[month].categories[category]) {
      summary[month].categories[category] = 0;
    }

    summary[month].categories[category] += Number(expense.amount || 0);
  });

  return Object.values(summary).sort((a, b) => {
    return b.month.localeCompare(a.month);
  });
}

function selectMonthFromSummary(month) {
  selectedMonth = month;
  monthFilter.value = month;
  renderAll();
}

function renderSummary() {
  const total = getTotalExpenses();
  const saving = getSaving();
  const top = getTopCategory();
  const activeAccounts = getActiveAccounts();

  const accountsBalance = accounts.reduce((sum, account) => {
    return sum + Number(account.balance || 0);
  }, 0);

  const budgetPercent = monthlyBudget > 0
    ? Math.min((total / monthlyBudget) * 100, 100)
    : 0;

  const savingPercentValue = savingGoal > 0
    ? Math.min((Math.max(saving, 0) / savingGoal) * 100, 100)
    : 0;

  let health = 100;

  if (total > income * 0.9) health -= 45;
  else if (total > income * 0.7) health -= 25;
  else if (total > income * 0.5) health -= 10;

  if (saving <= 0) health -= 35;
  else if (saving < income * 0.15) health -= 15;

  if (activeAccounts.length === 0) health -= 20;

  health = Math.max(0, Math.min(100, health));

  document.getElementById("totalIncome").textContent = formatMoney(getTotalIncome());
  document.getElementById("totalExpenses").textContent = formatMoney(total);
  document.getElementById("currentSaving").textContent = formatMoney(saving);
  document.getElementById("topCategory").textContent = top.category;

  document.getElementById("generalBalance").textContent = formatMoney(saving);
  document.getElementById("healthScore").textContent = `${health}%`;
  document.getElementById("activeAccountsCount").textContent = activeAccounts.length;
  document.getElementById("totalAccountsBalance").textContent = formatMoney(accountsBalance);
  document.getElementById("budgetUsedPercent").textContent = `${budgetPercent.toFixed(0)}%`;
  document.getElementById("expensesCount").textContent = getFilteredExpensesByMonth().length;

  document.getElementById("miniBudgetText").textContent =
    `${formatMoney(total)} usado de ${formatMoney(monthlyBudget)}`;

  document.getElementById("miniBudgetProgress").style.width = `${budgetPercent}%`;

  document.getElementById("miniSavingText").textContent =
    `${formatMoney(Math.max(saving, 0))} ahorrado de ${formatMoney(savingGoal)}`;

  document.getElementById("miniSavingProgress").style.width = `${savingPercentValue}%`;

  const balanceMessage = document.getElementById("balanceMessage");

  if (health >= 80) {
    balanceMessage.textContent = `Excelente. En ${formatMonthName(selectedMonth)} tu situación financiera se ve saludable.`;
  } else if (health >= 55) {
    balanceMessage.textContent = `Vas bien en ${formatMonthName(selectedMonth)}, pero hay categorías que deberías controlar.`;
  } else {
    balanceMessage.textContent = `Atención. En ${formatMonthName(selectedMonth)} tus gastos afectan tu capacidad de ahorro.`;
  }

  const percentage = income > 0 ? (total / income) * 100 : 0;

  if (percentage >= 85) {
    document.getElementById("sidebarStatus").textContent = "Alerta: gastos altos.";
  } else if (percentage >= 65) {
    document.getElementById("sidebarStatus").textContent = "Moderado: controla gastos.";
  } else {
    document.getElementById("sidebarStatus").textContent = "Saludable: buen control.";
  }

  renderQuickAlerts(health, budgetPercent, saving, top);
}

function renderQuickAlerts(health, budgetPercent, saving, top) {
  const box = document.getElementById("quickAlerts");
  box.innerHTML = "";

  const alerts = [];

  if (health >= 80) {
    alerts.push({
      type: "good",
      text: "Tu salud financiera está fuerte este mes."
    });
  } else if (health >= 55) {
    alerts.push({
      type: "warning",
      text: "Tu salud financiera es regular. Revisa gastos no necesarios."
    });
  } else {
    alerts.push({
      type: "danger",
      text: "Tu salud financiera está baja. Reduce gastos urgentes."
    });
  }

  if (budgetPercent >= 90) {
    alerts.push({
      type: "danger",
      text: "Ya casi consumes todo tu presupuesto mensual."
    });
  } else if (budgetPercent >= 70) {
    alerts.push({
      type: "warning",
      text: "Has usado más del 70% de tu presupuesto."
    });
  } else {
    alerts.push({
      type: "good",
      text: "Tu presupuesto aún tiene buen margen disponible."
    });
  }

  if (saving <= 0) {
    alerts.push({
      type: "danger",
      text: "Este mes no estás ahorrando. Pausa gastos opcionales."
    });
  }

  if (top.category !== "---") {
    alerts.push({
      type: "warning",
      text: `Tu mayor gasto está en ${top.category}.`
    });
  }

  alerts.forEach(alert => {
    const div = document.createElement("div");
    div.className = `quick-alert ${alert.type}`;
    div.textContent = alert.text;
    box.appendChild(div);
  });
}

function renderMonthlySummary() {
  const box = document.getElementById("monthlySummaryList");
  if (!box) return;

  const summary = getMonthlySummary();

  box.innerHTML = "";

  if (summary.length === 0) {
    box.innerHTML = `
      <div class="recommendation info">
        Todavía no hay gastos registrados para mostrar un resumen mensual.
      </div>
    `;
    return;
  }

  summary.forEach(item => {
    const saving = getTotalIncome() - item.total

    const topCategoryEntry = Object.entries(item.categories).sort((a, b) => b[1] - a[1])[0];

    const topCategory = topCategoryEntry ? topCategoryEntry[0] : "---";

    const div = document.createElement("div");

    div.className = `monthly-summary-item ${item.month === selectedMonth ? "active-month" : ""}`;

    div.innerHTML = `
      <div class="monthly-summary-month">
        <strong>${formatMonthName(item.month)}</strong>
        <span>${item.month === selectedMonth ? "Mes seleccionado" : "Click para ver este mes"}</span>
      </div>

      <div class="monthly-summary-data">
        <span>Gastos</span>
        <strong>${formatMoney(item.total)}</strong>
      </div>

      <div class="monthly-summary-data">
        <span>Ahorro</span>
        <strong class="${saving >= 0 ? "monthly-positive" : "monthly-negative"}">
          ${formatMoney(saving)}
        </strong>
      </div>

      <div class="monthly-summary-data">
        <span>Movimientos</span>
        <strong>${item.count}</strong>
      </div>

      <div class="monthly-summary-data">
        <span>Mayor categoría</span>
        <strong>${topCategory}</strong>
      </div>
    `;

    div.addEventListener("click", () => selectMonthFromSummary(item.month));

    box.appendChild(div);
  });
}

function renderAccountOptions() {
  const select = document.getElementById("expenseAccount");
  select.innerHTML = "";

  const activeAccounts = getActiveAccounts();

  if (activeAccounts.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No hay cuentas activas";
    option.value = "";
    select.appendChild(option);
    return;
  }

  activeAccounts.forEach(account => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = `${account.name} - ${account.type}`;
    select.appendChild(option);
  });
}

function getAccountName(id) {
  const account = accounts.find(account => String(account.id) === String(id));
  return account ? account.name : "Cuenta no encontrada";
}

function renderExpenses() {
  const list = document.getElementById("expenseList");
  const selectedCategory = filterCategory.value;

  let filtered = getFilteredExpensesByMonth();

  if (selectedCategory !== "Todos") {
    filtered = filtered.filter(expense => expense.category === selectedCategory);
  }

  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="recommendation info">
        No hay gastos registrados en este mes o categoría.
      </div>
    `;
    return;
  }

  filtered.forEach(expense => {
    const div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <div class="expense-info">
        <strong>${expense.name}</strong>
        <span>${expense.date || ""} · ${expense.type || "Variable"} · ${getAccountName(expense.accountId)}</span>
      </div>

      <span class="badge">${expense.category || "Otros"}</span>
      <strong class="amount">${formatMoney(expense.amount)}</strong>

      <button class="delete-btn" onclick="deleteExpense('${expense.id}')">
        Eliminar
      </button>
    `;

    list.appendChild(div);
  });
}

function renderAccounts() {
  const list = document.getElementById("accountList");
  list.innerHTML = "";

  if (accounts.length === 0) {
    list.innerHTML = `
      <div class="recommendation info">
        Todavía no tienes cuentas registradas.
      </div>
    `;
    return;
  }

  accounts.forEach(account => {
    const div = document.createElement("div");
    div.className = "account-item";

    div.innerHTML = `
      <div class="account-info">
        <strong>${account.name}</strong>
        <span>${account.type} · Saldo: ${formatMoney(account.balance)}</span>
      </div>

      <span class="badge ${account.active ? "" : "off"}">
        ${account.active ? "Activa" : "Inactiva"}
      </span>

      <button class="toggle-btn ${account.active ? "" : "off"}" onclick="toggleAccount('${account.id}', ${account.active})">
        ${account.active ? "Desactivar" : "Activar"}
      </button>

      <button class="delete-btn" onclick="deleteAccount('${account.id}')">
        Eliminar
      </button>
    `;

    list.appendChild(div);
  });
}

function renderSaving() {
  const saving = Math.max(getSaving(), 0);

  const percent = savingGoal > 0
    ? Math.min((saving / savingGoal) * 100, 100)
    : 0;

  document.getElementById("savingGoalText").textContent = formatMoney(savingGoal);
  document.getElementById("savingPercent").textContent = `${percent.toFixed(0)}%`;
  document.getElementById("savingProgress").style.width = `${percent}%`;
}

function renderBudget() {
  const total = getTotalExpenses();

  const percent = monthlyBudget > 0
    ? Math.min((total / monthlyBudget) * 100, 100)
    : 0;

  const progress = document.getElementById("budgetProgress");

  document.getElementById("budgetText").textContent = formatMoney(monthlyBudget);
  progress.style.width = `${percent}%`;

  if (percent >= 90) {
    progress.style.background = "linear-gradient(90deg, #ef4444, #f97316)";
  } else if (percent >= 70) {
    progress.style.background = "linear-gradient(90deg, #f59e0b, #facc15)";
  } else {
    progress.style.background = "linear-gradient(90deg, #22c55e, #84cc16)";
  }
}

function renderRecommendations() {
  const box = document.getElementById("recommendations");
  box.innerHTML = "";

  const total = getTotalExpenses();
  const saving = getSaving();
  const top = getTopCategory();
  const percentage = income > 0 ? (total / income) * 100 : 0;

  const messages = [];

  if (percentage >= 90) {
    messages.push({
      type: "danger",
      text: `En ${formatMonthName(selectedMonth)} tus gastos están muy altos. Debes reducir principalmente en ${top.category}.`
    });
  } else if (percentage >= 70) {
    messages.push({
      type: "warning",
      text: `En ${formatMonthName(selectedMonth)} estás usando una parte importante de tus ingresos. Revisa tus gastos en ${top.category}.`
    });
  } else {
    messages.push({
      type: "good",
      text: `Buen manejo financiero en ${formatMonthName(selectedMonth)}. Tus gastos están dentro de un rango saludable.`
    });
  }

  if (saving <= 0) {
    messages.push({
      type: "danger",
      text: "No estás generando ahorro este mes. Reduce gastos opcionales."
    });
  } else if (saving < income * 0.15) {
    messages.push({
      type: "warning",
      text: "Tu ahorro es bajo. Intenta ahorrar al menos 15% de tus ingresos."
    });
  } else {
    messages.push({
      type: "good",
      text: "Vas bien. Estás dejando una buena cantidad para ahorro."
    });
  }

  if (getActiveAccounts().length === 0) {
    messages.push({
      type: "danger",
      text: "No tienes cuentas activas. Activa una cuenta para registrar nuevos gastos."
    });
  }

  const optionalTotal = getFilteredExpensesByMonth()
    .filter(expense => expense.type === "Opcional")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  if (optionalTotal > total * 0.3 && total > 0) {
    messages.push({
      type: "info",
      text: "Tus gastos opcionales están algo altos. Podrías reducir compras, salidas o entretenimiento."
    });
  }

  messages.forEach(message => {
    const div = document.createElement("div");
    div.className = `recommendation ${message.type}`;
    div.textContent = message.text;
    box.appendChild(div);
  });
}

function renderCharts() {
  renderCategoryChart();
  renderTrendChart();
  renderTypeChart();
  renderIncomeExpenseChart();
}

function renderCategoryChart() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;

  const grouped = groupByCategory();

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        data: Object.values(grouped),
        backgroundColor: [
          "#4f8cff",
          "#7c3aed",
          "#22c55e",
          "#f59e0b",
          "#ef4444",
          "#06b6d4",
          "#ec4899",
          "#84cc16",
          "#f97316",
          "#64748b"
        ],
        borderColor: "#ffffff",
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function renderTrendChart() {
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;

  const summary = getMonthlySummary().slice().reverse();

  const labels = summary.map(item => formatMonthName(item.month));
  const gastos = summary.map(item => item.total);
  const ahorros = summary.map(item => getTotalIncome() - item.total);

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Gastos",
          data: gastos,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.12)",
          fill: true,
          tension: 0.35
        },
        {
          label: "Ahorro",
          data: ahorros,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.12)",
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderTypeChart() {
  const ctx = document.getElementById("typeChart");
  if (!ctx) return;

  const grouped = groupByType();

  if (typeChart) typeChart.destroy();

  typeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        label: "Monto",
        data: Object.values(grouped),
        backgroundColor: [
          "#4f8cff",
          "#22c55e",
          "#f59e0b",
          "#ef4444"
        ],
        borderRadius: 12
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderIncomeExpenseChart() {
  const ctx = document.getElementById("incomeExpenseChart");
  if (!ctx) return;

  if (incomeExpenseChart) incomeExpenseChart.destroy();

  incomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Ingresos", "Gastos", "Ahorro"],
      datasets: [{
        label: "Monto",
        data: [
          income,
          getTotalExpenses(),
          Math.max(getSaving(), 0)
        ],
        backgroundColor: [
          "#4f8cff",
          "#ef4444",
          "#22c55e"
        ],
        borderRadius: 14
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function deleteExpense(id) {
  await deleteDoc(doc(db, "users", currentUser.uid, "expenses", id));
}

async function toggleAccount(id, active) {
  await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), {
    active: !active,
    updatedAt: serverTimestamp()
  });
}

async function deleteAccount(id) {
  const hasExpenses = expenses.some(expense => {
    return String(expense.accountId) === String(id);
  });

  if (hasExpenses) {
    alert("Esta cuenta tiene gastos asociados. Mejor desactívala para no perder relación con tus datos.");
    return;
  }

  await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
}

expenseForm.addEventListener("submit", async event => {
  event.preventDefault();

  const activeAccounts = getActiveAccounts();

  if (activeAccounts.length === 0) {
    alert("No tienes cuentas activas. Activa o crea una cuenta primero.");
    return;
  }

  const name = document.getElementById("expenseName").value.trim();
  const amount = Number(document.getElementById("expenseAmount").value);
  const category = document.getElementById("expenseCategory").value;
  const type = document.getElementById("expenseType").value;
  const accountId = document.getElementById("expenseAccount").value;
  const date = document.getElementById("expenseDate").value;

  if (!name || amount <= 0 || !date || !accountId) {
    alert("Completa todos los campos correctamente.");
    return;
  }

  await addDoc(expensesCollectionRef(), {
    name,
    amount,
    category,
    type,
    accountId,
    date,
    createdAt: serverTimestamp()
  });

  expenseForm.reset();
  document.getElementById("expenseDate").valueAsDate = new Date();
});

accountForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("accountName").value.trim();
  const balance = Number(document.getElementById("accountBalance").value);
  const type = document.getElementById("accountType").value;

  if (!name || balance < 0) {
    alert("Completa los datos de la cuenta correctamente.");
    return;
  }

  await addDoc(accountsCollectionRef(), {
    name,
    balance,
    type,
    active: true,
    createdAt: serverTimestamp()
  });

  accountForm.reset();
});

filterCategory.addEventListener("change", renderExpenses);

document.getElementById("updateIncomeBtn").addEventListener("click", async () => {
  const value = Number(document.getElementById("incomeInput").value);

  if (value <= 0) {
    alert("Ingresa un ingreso válido.");
    return;
  }

  income = value;
  document.getElementById("incomeInput").value = "";

  await saveSettings();
  renderAll();
});

document.getElementById("updateGoalBtn").addEventListener("click", async () => {
  const value = Number(document.getElementById("goalInput").value);

  if (value <= 0) {
    alert("Ingresa una meta válida.");
    return;
  }

  savingGoal = value;
  document.getElementById("goalInput").value = "";

  await saveSettings();
  renderAll();
});

document.getElementById("updateBudgetBtn").addEventListener("click", async () => {
  const value = Number(document.getElementById("budgetInput").value);

  if (value <= 0) {
    alert("Ingresa un presupuesto válido.");
    return;
  }

  monthlyBudget = value;
  document.getElementById("budgetInput").value = "";

  await saveSettings();
  renderAll();
});

function renderAll() {
  renderSummary();
  renderMonthlySummary();
  renderAccountOptions();
  renderExpenses();
  renderAccounts();
  renderIncomes();
  renderSaving();
  renderBudget();
  renderRecommendations();

  const reportesVisible = document
    .getElementById("reportes")
    .classList
    .contains("active-section");

  if (reportesVisible) {
    renderCharts();
  }
}
const incomeForm = document.getElementById("incomeForm");

incomeForm.addEventListener("submit", async e => {
  e.preventDefault();

  const name = document.getElementById("incomeName").value.trim();
  const amount = Number(document.getElementById("incomeAmount").value);
  const category = document.getElementById("incomeCategory").value;
  const accountId = document.getElementById("incomeAccount").value;
  const date = document.getElementById("incomeDate").value;

  if (!name || amount <= 0 || !date || !accountId) {
    alert("Completa los datos del ingreso.");
    return;
  }

  await addDoc(incomesCollectionRef(), {
    name,
    amount,
    category,
    accountId,
    date,
    createdAt: serverTimestamp()
  });

  // SUMAR A CUENTA
  const acc = accounts.find(a => a.id === accountId);

  if (acc) {
    await updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), {
      balance: Number(acc.balance || 0) + amount
    });
  }

  incomeForm.reset();
});
function renderIncomes() {
  const list = document.getElementById("incomeList");
  if (!list) return;

  list.innerHTML = "";

  const filtered = incomes.filter(i => i.date?.startsWith(selectedMonth));

  if (filtered.length === 0) {
    list.innerHTML = `<div class="recommendation info">No hay ingresos.</div>`;
    return;
  }

  filtered.forEach(i => {
    const div = document.createElement("div");
    div.className = "income-item";

    div.innerHTML = `
      <div class="income-info">
        <strong>${i.name}</strong>
        <span>${i.date}</span>
      </div>

      <span class="badge">${i.category}</span>
      <strong class="amount-income">${formatMoney(i.amount)}</strong>

      <button class="delete-btn" onclick="deleteIncome('${i.id}')">
        Eliminar
      </button>
    `;

    list.appendChild(div);
  });
}
window.deleteIncome = async id => {
  await deleteDoc(doc(db, "users", currentUser.uid, "incomes", id));
};
/* app.js
   Gerencia rotinas: criação, edição, remoção, comentários, filtros, export/import.
   Salva tudo em localStorage sob a key "rutinas_data".
*/

const STORAGE_KEY = "rutinas_data";

/* DOM refs */
const views = document.querySelectorAll(".view");
const menuBtns = document.querySelectorAll(".menu-btn");
const viewSwitcher = (v) => {
  views.forEach(x => x.classList.remove("active"));
  document.getElementById("view-" + v).classList.add("active");
  menuBtns.forEach(b => b.classList.toggle("active", b.dataset.view === v));
};

/* Sidebar menu */
menuBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.view;
    viewSwitcher(v);
  });
});

/* Quick action switches */
document.querySelectorAll("[data-view-switch]").forEach(b => {
  b.addEventListener("click", () => viewSwitcher(b.dataset.viewSwitch));
});

/* Storage helpers */
function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { routines: [], activities: [] };
  } catch(e) {
    return { routines: [], activities: [] };
  }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* Utils */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function todayDayIndex() { return new Date().getDay(); } // 0-6
function formatTime(t) { return t || "—"; }

/* App state */
let state = loadData();

/* Elements */
const routinesList = document.getElementById("routinesList");
const totalRoutines = document.getElementById("totalRoutines");
const completedToday = document.getElementById("completedToday");
const nextRoutineEl = document.getElementById("nextRoutine");
const searchInput = document.getElementById("searchInput");
const filterBy = document.getElementById("filterBy");
const sortBy = document.getElementById("sortBy");
const routineForm = document.getElementById("routineForm");
const routineId = document.getElementById("routineId");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const timeInput = document.getElementById("time");
const repeatSelect = document.getElementById("repeat");
const daysCheckboxes = document.querySelectorAll(".days input[type=checkbox]");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const clearAllBtn = document.getElementById("clearAll");
const bulkCompleteBtn = document.getElementById("bulkComplete");
const enableNotifications = document.getElementById("enableNotifications");
const byDayList = document.getElementById("byDayList");
const recentActivities = document.getElementById("recentActivities");

/* Initialization */
renderAll();
attachListeners();

/* RENDER */
function renderAll() {
  renderList();
  renderSummary();
  renderReports();
}

function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  let list = state.routines.slice();

  // filters
  const f = filterBy.value;
  const dayIdx = todayDayIndex();

  if (f === "today") {
    list = list.filter(r => r.days && (r.days.includes(dayIdx.toString()) || r.repeat === "daily"));
  } else if (f === "completed") {
    list = list.filter(r => r.concluded);
  } else if (f === "pending") {
    list = list.filter(r => !r.concluded);
  }

  // search
  if (q) list = list.filter(r => (r.title + " " + (r.description||"")).toLowerCase().includes(q));

  // sort
  if (sortBy.value === "name") list.sort((a,b) => a.title.localeCompare(b.title));
  else if (sortBy.value === "time") list.sort((a,b) => (a.time||"").localeCompare(b.time||""));
  else { // next
    list.sort((a,b) => {
      const ta = a.time || "23:59", tb = b.time || "23:59";
      return ta.localeCompare(tb);
    });
  }

  // render
  routinesList.innerHTML = "";
  if (!list.length) {
    routinesList.innerHTML = `<div class="card">Nenhuma rotina encontrada.</div>`;
    return;
  }

  list.forEach(r => {
    const li = document.createElement("li");
    li.className = "routine-item" + (r.concluded ? " concluded" : "");
    li.innerHTML = `
      <div class="meta">
        <h4>${escapeHtml(r.title)}</h4>
        <p>${escapeHtml(r.description||"")}</p>
        <p style="margin-top:8px;font-size:13px;color:var(--muted)">
          Horário: <strong>${formatTime(r.time)}</strong> · Repetir: <strong>${r.repeat || '—'}</strong>
          · Dias: ${formatDaysDisplay(r.days)}
        </p>
      </div>
      <div class="routine-actions">
        <button class="icon-btn" data-action="toggle">${r.concluded ? '↺' : '✓'}</button>
        <button class="icon-btn" data-action="comments">💬</button>
        <button class="icon-btn" data-action="edit">✎</button>
        <button class="icon-btn" data-action="delete">🗑</button>
      </div>
    `;

    // action handlers
    li.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleComplete(r.id));
    li.querySelector('[data-action="comments"]').addEventListener("click", () => openComments(r.id));
    li.querySelector('[data-action="edit"]').addEventListener("click", () => loadIntoForm(r.id));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRoutine(r.id));

    routinesList.appendChild(li);
  });
}

function renderSummary() {
  totalRoutines.textContent = state.routines.length;
  const todayIdx = todayDayIndex();
  const completed = state.routines.filter(r => r.concluded && r.days && r.days.includes(todayIdx.toString())).length;
  completedToday.textContent = completed;

  const upcoming = state.routines
    .filter(r => r.time)
    .sort((a,b) => (a.time||"").localeCompare(b.time||""))[0];
  nextRoutineEl.textContent = upcoming ? `${upcoming.title} às ${upcoming.time}` : "—";
}

function renderReports() {
  // by day
  const days = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  byDayList.innerHTML = "";
  days.forEach((d, idx) => {
    const count = state.routines.filter(r => r.days && r.days.includes(idx.toString())).length;
    const li = document.createElement("li");
    li.textContent = `${d}: ${count} rotina(s)`;
    byDayList.appendChild(li);
  });

  // recent activities
  recentActivities.innerHTML = "";
  const recent = state.activities.slice().reverse().slice(0,8);
  if (!recent.length) recentActivities.innerHTML = "<li>Nenhuma atividade recente.</li>";
  else recent.forEach(a => {
    const el = document.createElement("li");
    el.textContent = `${new Date(a.time).toLocaleString()} — ${a.text}`;
    recentActivities.appendChild(el);
  });
}

/* FORM actions */
routineForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saveRoutineFromForm();
});

document.getElementById("resetForm").addEventListener("click", () => {
  routineForm.reset();
  routineId.value = "";
});

/* Search / filters */
searchInput.addEventListener("input", renderList);
filterBy.addEventListener("change", renderList);
sortBy.addEventListener("change", renderList);

/* Export / import */
exportBtn.addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "rotinas_export.json"; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", handleImportFile);

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (imported.routines) {
        state = imported;
        saveData(state);
        renderAll();
        alert("Importação concluída.");
      } else alert("Arquivo inválido.");
    } catch(err) {
      alert("Erro ao importar: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* Clear / bulk */
clearAllBtn.addEventListener("click", () => {
  if (!confirm("Deseja realmente apagar todas as rotinas?")) return;
  state.routines = [];
  state.activities.push({time:Date.now(), text:"Apagou todas as rotinas"});
  saveData(state);
  renderAll();
});
bulkCompleteBtn.addEventListener("click", () => {
  state.routines.forEach(r => r.concluded = true);
  state.activities.push({time:Date.now(), text:"Marcou todas as rotinas como concluídas"});
  saveData(state);
  renderAll();
});

/* CRUD */
function saveRoutineFromForm() {
  const id = routineId.value || uid();
  const data = {
    id,
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    time: timeInput.value || null,
    repeat: repeatSelect.value,
    days: Array.from(daysCheckboxes).filter(c=>c.checked).map(c=>c.value),
    concluded: false,
    comments: []
  };
  // validate
  if (!data.title) return alert("Título obrigatório.");

  // update or add
  const idx = state.routines.findIndex(r => r.id === id);
  if (idx >= 0) {
    data.concluded = state.routines[idx].concluded; // preserve
    data.comments = state.routines[idx].comments || [];
    state.routines[idx] = data;
    state.activities.push({time:Date.now(), text: `Editou rotina: ${data.title}`});
  } else {
    state.routines.push(data);
    state.activities.push({time:Date.now(), text: `Criou rotina: ${data.title}`});
  }
  saveData(state);
  routineForm.reset(); routineId.value = "";
  renderAll();
  viewSwitcher("rotinas");
}

/* Load into form for edit */
function loadIntoForm(id) {
  const r = state.routines.find(x => x.id === id);
  if (!r) return;
  routineId.value = r.id;
  titleInput.value = r.title;
  descriptionInput.value = r.description || "";
  timeInput.value = r.time || "";
  repeatSelect.value = r.repeat || "none";
  daysCheckboxes.forEach(cb => cb.checked = r.days && r.days.includes(cb.value));
  viewSwitcher("criar");
}

/* Toggle complete */
function toggleComplete(id) {
  const r = state.routines.find(x => x.id === id);
  if (!r) return;
  r.concluded = !r.concluded;
  state.activities.push({time:Date.now(), text: `${r.concluded ? "Concluiu" : "Reabriu"}: ${r.title}`});
  saveData(state);
  renderAll();
}

/* Delete */
function deleteRoutine(id) {
  const r = state.routines.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Apagar rotina "${r.title}"?`)) return;
  state.routines = state.routines.filter(x => x.id !== id);
  state.activities.push({time:Date.now(), text: `Removeu rotina: ${r.title}`});
  saveData(state);
  renderAll();
}

/* Comments modal */
function openComments(id) {
  const r = state.routines.find(x => x.id === id);
  if (!r) return;
  modalBody.innerHTML = `
    <h3>Comentários — ${escapeHtml(r.title)}</h3>
    <div id="commentsList" style="margin-top:12px"></div>
    <textarea id="commentInput" rows="3" placeholder="Adicione um comentário..."></textarea>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button id="addCommentBtn">Adicionar comentário</button>
      <button id="closeModalBtn">Fechar</button>
    </div>
  `;
  modal.setAttribute("aria-hidden", "false");
  renderComments(r);
  document.getElementById("addCommentBtn").addEventListener("click", () => {
    const txt = document.getElementById("commentInput").value.trim();
    if (!txt) return;
    r.comments = r.comments || [];
    r.comments.push({id: uid(), text: txt, time: Date.now()});
    state.activities.push({time:Date.now(), text: `Comentou em ${r.title}`});
    saveData(state);
    renderComments(r);
    document.getElementById("commentInput").value = "";
  });
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
}

function renderComments(r) {
  const list = document.getElementById("commentsList");
  list.innerHTML = "";
  (r.comments || []).forEach(c => {
    const el = document.createElement("div");
    el.style.padding = "8px"; el.style.borderBottom = "1px solid #f0f4ff";
    el.innerHTML = `<div style="font-size:13px;color:var(--muted)">${new Date(c.time).toLocaleString()}</div>
                    <div style="margin-top:6px">${escapeHtml(c.text)}</div>
                    <div style="margin-top:6px"><button data-cid="${c.id}" class="deleteC">Remover</button></div>`;
    list.appendChild(el);
    el.querySelector(".deleteC").addEventListener("click", () => {
      r.comments = r.comments.filter(x => x.id !== c.id);
      state.activities.push({time:Date.now(), text: `Removeu comentário em ${r.title}`});
      saveData(state);
      renderComments(r);
    });
  });
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target===modal) closeModal(); });
function closeModal(){ modal.setAttribute("aria-hidden","true"); modalBody.innerHTML = ""; }

/* Small helpers */
function formatDaysDisplay(days){
  if(!days || !days.length) return "—";
  const map = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return days.map(d => map[Number(d)]).join(", ");
}
function escapeHtml(s){ if(!s) return ""; return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

/* Notifications (optional) */
enableNotifications && enableNotifications.addEventListener("change", async (e) => {
  if(e.target.checked){
    if (!("Notification" in window)) return alert("Seu navegador não suporta notificações.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { e.target.checked = false; alert("Notificações não autorizadas."); }
  }
});

/* Periodic check for upcoming (simple) */
setInterval(() => {
  // check if any routine matches current time (HH:MM)
  const now = new Date();
  const hhmm = now.toTimeString().slice(0,5);
  const d = now.getDay().toString();
  state.routines.forEach(r => {
    if (r.time === hhmm) {
      const allowed = (r.repeat === "daily") || (r.days && r.days.includes(d)) || (!r.days || r.days.length===0);
      if (allowed) {
        // push activity
        state.activities.push({time:Date.now(), text: `Notificação: ${r.title}`});
        saveData(state);
        // show browser notification
        if (enableNotifications && enableNotifications.checked && Notification.permission === "granted") {
          new Notification("Rotina: " + r.title, {body: r.description || "", silent: true});
        }
      }
    }
  });
  renderReports();
}, 30*1000); // checa a cada 30s

/* Render initial data */
function attachListeners(){ renderAll(); }

/* Seed demo data if empty (so o site não fica vazio) */
if (!state.routines.length) {
  state.routines.push({
    id: uid(),
    title: "Ex: Caminhada matinal",
    description: "20 minutos de caminhada",
    time: "07:30",
    repeat: "daily",
    days: ["1","2","3","4","5"],
    concluded: false,
    comments: [{id: uid(), text: "Comecei semana passada, tá indo bem", time: Date.now()}]
  });
  saveData(state);
  renderAll();
}

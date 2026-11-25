(() => {
  const $ = (s) => document.querySelector(s);
  const escapeHTML = (v = "") =>
    String(v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const cfg = window.FORGE_CONFIG || {};
  let supabase, session = null, isAdmin = false, currentResource = "trainings", editingId = null, records = [];

  const labels = {
    trainings: "Modalidades",
    coaches: "Professores",
    schedules: "Horários",
    locations: "Unidades"
  };

  const fields = {
    trainings: [
      ["name", "Nome", "text", true],
      ["description", "Descrição", "textarea", true],
      ["sort_order", "Ordem de exibição", "number", true]
    ],
    coaches: [
      ["name", "Nome", "text", true],
      ["specialty", "Especialidade", "text", true],
      ["bio", "Biografia", "textarea", true],
      ["photo_url", "URL da foto", "url", false],
      ["initials", "Iniciais", "text", false]
    ],
    schedules: [
      ["day_of_week", "Dia da semana", "select", true],
      ["open_time", "Abertura", "time", false],
      ["close_time", "Fechamento", "time", false],
      ["is_closed", "Unidade fechada?", "checkbox", false]
    ],
    locations: [
      ["name", "Nome da unidade", "text", true],
      ["address", "Endereço", "text", true],
      ["phone", "Telefone", "tel", false],
      ["email", "E-mail", "email", false],
      ["map_url", "Link do Google Maps", "url", false],
      ["embed_url", "URL do mapa incorporado", "url", false]
    ]
  };

  const days = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado"
  ];

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3500);
  }

  function message(el, msg, error = false) {
    el.textContent = msg;
    el.classList.toggle("error", error);
  }

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    };
  }

  async function api(resource, method = "GET", body = null, id = null) {
    const url = `${cfg.API_BASE_URL}/api/${resource}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
    const res = await fetch(url, {
      method,
      headers: apiHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
  }

  function setModal(el, open) {
    el.classList.toggle("open", open);
    el.setAttribute("aria-hidden", String(!open));
  }

  async function loadPublic() {
    const resources = ["trainings", "coaches", "schedules", "locations"];
    await Promise.all(
      resources.map(async (r) => {
        try {
          renderPublic(r, await api(r));
        } catch (e) {
          const el = $(`#${r}-container`);
          if (el) el.innerHTML = `<p class="empty-state status-error">${escapeHTML(e.message)}</p>`;
        }
      })
    );
  }

  function renderPublic(r, rows) {
    const el = $(`#${r}-container`);
    if (!el) return;

    if (r === "trainings") {
      el.innerHTML = rows.length
        ? rows
            .map(
              (x) =>
                `<article class="training-card"><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.description || "")}</p></article>`
            )
            .join("")
        : "<p>Nenhuma modalidade cadastrada.</p>";
    }

    if (r === "coaches") {
      el.innerHTML = rows.length
        ? rows
            .map(
              (x) =>
                `<article class="coach-card">${
                  x.photo_url
                    ? `<img src="${escapeHTML(x.photo_url)}" alt="Foto de ${escapeHTML(x.name)}">`
                    : `<div class="coach-initials">${escapeHTML(x.initials || "FF")}</div>`
                }<h3>${escapeHTML(x.name)}</h3><h4>${escapeHTML(x.specialty || "")}</h4><p>${escapeHTML(x.bio || "")}</p></article>`
            )
            .join("")
        : "<p>Nenhum professor cadastrado.</p>";
    }

    if (r === "schedules") {
      el.innerHTML = rows.length
        ? [...rows]
            .sort((a, b) => a.day_of_week - b.day_of_week)
            .map(
              (x) =>
                `<div class="schedule-row"><strong>${days[x.day_of_week] || "Dia"}</strong><span>${
                  x.is_closed
                    ? "Fechado"
                    : `${String(x.open_time || "").slice(0, 5)} às ${String(x.close_time || "").slice(0, 5)}`
                }</span></div>`
            )
            .join("")
        : "<p>Nenhum horário cadastrado.</p>";
    }

    if (r === "locations") {
      el.innerHTML = rows.length
        ? rows
            .map(
              (x) =>
                `<article class="location-card"><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.address || "")}</p>${
                  x.phone ? `<p>Telefone: ${escapeHTML(x.phone)}</p>` : ""
                }${x.email ? `<p>E-mail: ${escapeHTML(x.email)}</p>` : ""}${
                  x.map_url
                    ? `<a href="${escapeHTML(x.map_url)}" target="_blank" rel="noopener">Abrir no Google Maps</a>`
                    : ""
                }${
                  x.embed_url
                    ? `<iframe src="${escapeHTML(x.embed_url)}" title="Mapa ${escapeHTML(x.name)}" loading="lazy"></iframe>`
                    : ""
                }</article>`
            )
            .join("")
        : "<p>Nenhuma unidade cadastrada.</p>";
    }
  }

  async function refreshAuth() {
    const { data: { session: s } } = await supabase.auth.getSession();
    session = s;
    isAdmin = false;

    if (session) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin,full_name")
          .eq("id", session.user.id)
          .single();
        if (!error) isAdmin = !!data.is_admin;
      } catch {}
    }

    $("#account-actions").innerHTML = session
      ? `<span class="user-email">${escapeHTML(session.user.email)}</span>${
          isAdmin ? '<a class="button" href="#admin-panel">Painel</a>' : ""
        }<button class="button button-outline" id="logout-top">Sair</button>`
      : '<button class="button button-outline" id="open-auth">Entrar / Cadastrar</button>';

    $("#open-auth")?.addEventListener("click", () => {
      authMode("login");
      setModal($("#auth-modal"), true);
    });
    $("#logout-top")?.addEventListener("click", logout);

    $("#admin-panel").hidden = !isAdmin;
    if (isAdmin) {
      await renderAdmin();
      $("#admin-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function authMode(mode) {
    const recovery = mode === "recovery";
    const reg = mode === "register";

    $(".auth-switch").hidden = recovery;
    $("#auth-form").hidden = recovery;
    if ($("#recovery-form")) $("#recovery-form").hidden = !recovery;

    if (recovery) {
      $("#auth-title").textContent = "Defina sua nova senha";
      $("#forgot-password").hidden = true;
    } else {
      $("#auth-title").textContent = reg ? "Criar sua conta" : "Acesse sua conta";
      $("#name-label").hidden = !reg;
      $("#auth-name").required = reg;
      $("#auth-submit").textContent = reg ? "Cadastrar" : "Entrar";
      $("#forgot-password").hidden = reg;
      $("#login-tab").classList.toggle("active", !reg);
      $("#register-tab").classList.toggle("active", reg);
      $("#auth-form").dataset.mode = mode;
    }
    message($("#auth-message"), "");
  }

  async function submitAuth(e) {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    const mode = $("#auth-form").dataset.mode;

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: $("#auth-name").value.trim() },
            emailRedirectTo: location.origin
          }
        });
        if (error) throw error;
        message(
          $("#auth-message"),
          data.session
            ? "Conta criada! Você já pode acessar."
            : "Cadastro realizado. Confira seu e-mail para confirmar a conta."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setModal($("#auth-modal"), false);
        toast("Login realizado.");
        await refreshAuth();
      }
    } catch (err) {
      message($("#auth-message"), err.message, true);
    }
  }

  async function submitRecovery(e) {
    e.preventDefault();
    const newPassword = $("#new-password").value;
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      $("#new-password").value = "";
      toast("Senha atualizada com sucesso.");
      setModal($("#auth-modal"), false);
      authMode("login");
      await refreshAuth();
    } catch (err) {
      message($("#auth-message"), err.message, true);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    session = null;
    isAdmin = false;
    $("#admin-panel").hidden = true;
    toast("Você saiu da sua conta.");
    await refreshAuth();
  }

  async function renderAdmin() {
    const all = await Promise.all(Object.keys(labels).map((r) => api(r)));
    $("#stats").innerHTML = Object.keys(labels)
      .map((r, i) => `<div class="stat"><strong>${all[i].length}</strong><span>${labels[r]}</span></div>`)
      .join("");
    await loadAdminResource();
  }

  async function loadAdminResource() {
    records = await api(currentResource);
    $("#resource-title").textContent = labels[currentResource];
    const q = $("#admin-search").value.toLowerCase();
    const visible = records.filter((x) => JSON.stringify(x).toLowerCase().includes(q));

    $("#admin-list").innerHTML = visible.length
      ? visible
          .map(
            (x) =>
              `<article class="admin-row"><div><strong>${escapeHTML(
                recordName(currentResource, x)
              )}</strong><small>${escapeHTML(recordDescription(currentResource, x))}</small></div><div class="row-actions"><button class="small-button edit" data-id="${
                x.id
              }">Editar</button><button class="small-button danger delete" data-id="${
                x.id
              }">Excluir</button></div></article>`
          )
          .join("")
      : "<p class='empty-state'>Nenhum registro encontrado.</p>";
  }

  function recordName(r, x) {
    return r === "schedules" ? days[x.day_of_week] : x.name || "Registro";
  }

  function recordDescription(r, x) {
    if (r === "trainings") return x.description || "";
    if (r === "coaches") return x.specialty || "";
    if (r === "schedules") {
      return x.is_closed
        ? "Fechado"
        : `${String(x.open_time || "").slice(0, 5)} às ${String(x.close_time || "").slice(0, 5)}`;
    }
    return x.address || "";
  }

  function openRecord(row = null) {
    editingId = row?.id ?? null;
    $("#record-title").textContent = row ? "Editar registro" : "Novo cadastro";

    $("#record-fields").innerHTML = fields[currentResource]
      .map(([key, label, type, required]) => {
        let value = row?.[key] ?? (key === "sort_order" ? 0 : key === "is_closed" ? false : "");
        if (type === "select") {
          return `<label>${label}<select name="${key}" required>${days
            .map((d, i) => `<option value="${i}" ${Number(value) === i ? "selected" : ""}>${d}</option>`)
            .join("")}</select></label>`;
        }
        if (type === "checkbox") {
          return `<label class="check-label"><input type="checkbox" name="${key}" ${
            value ? "checked" : ""
          }> ${label}</label>`;
        }
        if (type === "textarea") {
          return `<label class="span-2">${label}<textarea name="${key}" ${
            required ? "required" : ""
          }>${escapeHTML(value)}</textarea></label>`;
        }
        return `<label>${label}<input name="${key}" type="${type}" value="${escapeHTML(value)}" ${
          required ? "required" : ""
        } ${type === "number" ? 'step="1"' : ""}></label>`;
      })
      .join("");

    message($("#record-message"), "");
    setModal($("#record-modal"), true);
  }

  async function saveRecord(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {};

    for (const [key, , type] of fields[currentResource]) {
      const el = e.target.elements[key];
      payload[key] =
        type === "checkbox"
          ? el.checked
          : type === "number"
          ? Number(form.get(key) || 0)
          : type === "select"
          ? Number(form.get(key))
          : form.get(key) || null;
    }

    if (currentResource === "schedules" && payload.is_closed) {
      payload.open_time = null;
      payload.close_time = null;
    }

    try {
      await api(currentResource, editingId ? "PUT" : "POST", payload, editingId);
      setModal($("#record-modal"), false);
      toast("Registro salvo com sucesso.");
      await renderAdmin();
      await loadPublic();
    } catch (err) {
      message($("#record-message"), err.message, true);
    }
  }

  async function deleteRecord(id) {
    if (!confirm("Tem certeza de que deseja excluir este registro?")) return;
    try {
      await api(currentResource, "DELETE", null, id);
      toast("Registro excluído.");
      await renderAdmin();
      await loadPublic();
    } catch (e) {
      toast(e.message);
    }
  }

  function setup() {
    $("#year").textContent = new Date().getFullYear();
    $(".menu-toggle").addEventListener("click", () => $("#nav-links").classList.toggle("open"));
    $("#open-auth").addEventListener("click", () => {
      authMode("login");
      setModal($("#auth-modal"), true);
    });
    $("#close-auth").addEventListener("click", () => setModal($("#auth-modal"), false));
    $("#close-record").addEventListener("click", () => setModal($("#record-modal"), false));

    $("#login-tab").addEventListener("click", () => authMode("login"));
    $("#register-tab").addEventListener("click", () => authMode("register"));
    $("#auth-form").addEventListener("submit", submitAuth);
    $("#recovery-form")?.addEventListener("submit", submitRecovery);

    $("#forgot-password").addEventListener("click", async () => {
      const email = $("#auth-email").value.trim();
      if (!email) return message($("#auth-message"), "Informe seu e-mail primeiro.", true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin
      });
      message(
        $("#auth-message"),
        error?.message || "Enviamos as instruções para seu e-mail."
      );
    });

    $("#logout").addEventListener("click", logout);
    $("#new-record").addEventListener("click", () => openRecord());
    $("#record-form").addEventListener("submit", saveRecord);
    $("#admin-search").addEventListener("input", loadAdminResource);

    $("#admin-tabs").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-resource]");
      if (!b) return;
      currentResource = b.dataset.resource;
      $("#admin-tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      $("#admin-search").value = "";
      await loadAdminResource();
    });

    $("#admin-list").addEventListener("click", (e) => {
      const edit = e.target.closest(".edit");
      const del = e.target.closest(".delete");
      if (edit) openRecord(records.find((x) => String(x.id) === edit.dataset.id));
      if (del) deleteRecord(del.dataset.id);
    });

    $("#auth-modal").addEventListener("click", (e) => {
      if (e.target.id === "auth-modal") setModal(e.currentTarget, false);
    });
    $("#record-modal").addEventListener("click", (e) => {
      if (e.target.id === "record-modal") setModal(e.currentTarget, false);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("SEU-PROJETO")) {
        throw new Error("Configure as credenciais públicas do Supabase em js/config.js.");
      }
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      setup();
      authMode("login");
      await loadPublic();
      await refreshAuth();

      supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          authMode("recovery");
          setModal($("#auth-modal"), true);
        } else {
          setTimeout(refreshAuth, 0);
        }
      });
    } catch (e) {
      console.error(e);
      setup();
      toast(e.message);
    }
  });
})();

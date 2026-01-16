(() => {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

  const STORAGE = {
    token: "polaris_portal_token",
    theme: "polaris_portal_theme",
  };

  const state = {
    me: null,
    runs: [],
    runById: new Map(),
  };

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function toast(message) {
    const root = getToastRoot();
    const item = document.createElement("div");
    item.className = "toast-item";
    item.innerHTML = `
      <div style="font-weight:700; margin-bottom:4px;">Notice</div>
      <div>${escapeHtml(message)}</div>
      <div class="small" style="margin-top:6px;">${formatDate(nowISO())}</div>
    `;
    root.appendChild(item);
    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(6px)";
      item.style.transition = "opacity 180ms ease, transform 180ms ease";
      setTimeout(() => item.remove(), 220);
    }, 2800);
  }

  function getToastRoot() {
    let root = qs("#toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      document.body.appendChild(root);
    }
    root.className = "toast";
    return root;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  function setTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    localStorage.setItem(STORAGE.theme, t);
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    if (saved) {
      setTheme(saved);
      return;
    }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }

  function getToken() {
    return localStorage.getItem(STORAGE.token);
  }

  function setToken(token) {
    if (!token) localStorage.removeItem(STORAGE.token);
    else localStorage.setItem(STORAGE.token, token);
  }

  function isAuthed() {
    return Boolean(getToken());
  }

  // ---- API LAYER (mock now, swap later) ----
  // Replace these with real fetch calls when ready.
  const api = {
    async login({ email, password }) {
      await sleep(450);
      if (!email.includes("@") || password.length < 6) {
        throw new Error("Invalid credentials. Try an email and a 6+ character password.");
      }
      return { token: "demo-token-" + Math.random().toString(16).slice(2) };
    },

    async me() {
      await sleep(180);
      return {
        name: "Drew",
        org: "polaris",
        role: "Admin",
        email: "drew@example.com",
      };
    },

    async runs() {
      await sleep(250);
      // A realistic shape that maps well to your backend runs folder concept.
      const base = new Date();
      const make = (i, status) => {
        const d = new Date(base.getTime() - i * 1000 * 60 * 75);
        const id = `run_${d.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${status.toLowerCase()}`;
        return {
          id,
          org_slug: "polaris",
          label: i % 2 === 0 ? "ad-hoc" : "scheduled",
          created_at: d.toISOString(),
          status,
          artifacts: {
            docx: true,
            text_extract: true,
            support_bundle: true,
          },
          summary: {
            domains_total: 7,
            domains_validated: status === "PASS" ? 4 : (status === "WARN" ? 2 : 0),
            overall_risk: status === "FAIL" ? "Critical" : (status === "WARN" ? "High" : "Medium"),
          },
        };
      };
      return [
        make(0, "WARN"),
        make(1, "PASS"),
        make(2, "FAIL"),
        make(3, "PASS"),
        make(4, "WARN"),
      ];
    },

    async run(id) {
      await sleep(220);
      // In real life, this would come from collection_health.json, integrity_result, etc.
      const run = state.runs.find(r => r.id === id) || (await this.runs()).find(r => r.id === id);
      if (!run) throw new Error("Run not found.");
      return {
        ...run,
        domains: [
          { name: "Identity", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Apps", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Endpoint", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Email", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Collaboration", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Compliance", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
          { name: "Data Protection", transport: "100%", validation: "Not collected", confidence: "NONE", status: "Not Collected" },
        ],
        actions: [
          { priority: "P0", title: "Privileged accounts without MFA", owner: "Identity Team", timeline: "0-7 days", effort: "S" },
          { priority: "P1", title: "User MFA coverage below baseline", owner: "Identity Team", timeline: "7-30 days", effort: "M" },
          { priority: "P2", title: "High-risk app permissions not verified", owner: "Apps Team", timeline: "7-30 days", effort: "M" },
        ],
        links: {
          // When you wire to backend, these become signed URLs or API downloads.
          docx_url: "#",
          text_extract_url: "#",
          support_bundle_url: "#",
        }
      };
    }
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---- ROUTER ----
  function route() {
    const app = qs("#app");
    if (!app) return;

    const path = location.hash.replace(/^#/, "") || "/";
    const [base, maybeId, tab] = path.split("/").filter(Boolean);

    // Auth gating:
    const publicRoutes = new Set(["", "/"]);
    const isPublic = path === "/" || path === "";
    if (!isPublic && !isAuthed()) {
      renderLogin(app);
      return;
    }

    // Layout:
    if (path === "/" || path === "") {
      renderLanding(app);
      return;
    }

    if (base === "login") {
      renderLogin(app);
      return;
    }

    if (base === "app") {
      renderAppShell(app, () => {
        // nested routes under /app
        if (!maybeId) {
          renderDashboard(qs("#shell-main"));
        } else if (maybeId === "settings") {
          renderSettings(qs("#shell-main"));
        } else if (maybeId === "runs" && tab) {
          renderRunDetails(qs("#shell-main"), tab);
        } else {
          renderNotFound(qs("#shell-main"));
        }
      });
      return;
    }

    renderNotFound(app);
  }

  // ---- UI ----
  function renderNav({ rightHtml = "" } = {}) {
    return `
      <div class="nav">
        <div class="container nav-inner">
          <a class="brand" href="#/">
            <div class="brand-badge" aria-hidden="true">
              <img class="brand-logo" src="./assets/polaris-logo.svg" alt="Polaris logo" />
            </div>
            <div class="brand-title">
              <strong>Polaris Security Portal</strong>
              <span>Verified reporting and evidence</span>
            </div>
          </a>

          <div class="nav-actions">
            ${rightHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderLanding(app) {
    app.innerHTML = `
      ${renderNav({
        rightHtml: isAuthed()
          ? `
            <a class="nav-link" href="#/" data-scroll="how-it-works">How it works</a>
            <a class="btn" href="#/app">Open Portal</a>
          `
          : `
            <a class="nav-link" href="#/" data-scroll="how-it-works">How it works</a>
            <a class="btn" href="#/login">Sign in</a>
          `
      })}
      <div class="container hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <h1 class="h-title">Evidence-backed security reporting.</h1>
            <p class="h-sub">
              Every report ships with the artifacts and evidence trails auditors ask for. No screenshots. No manual packaging.
            </p>
            <ul class="hero-list">
              <li><span class="mono">report.docx</span> + <span class="mono">report_text_extract.txt</span> + <span class="mono">support_bundle.zip</span></li>
              <li>PASS, WARN, FAIL history with timestamps and manifests</li>
              <li>Evidence keys and paths for questionnaires and audits</li>
            </ul>
            <div class="cta-row">
              <a class="btn primary" href="#/app">View demo</a>
              <a class="btn" href="#/login">Sign in</a>
            </div>
            <a class="text-link hero-link" href="#/" data-scroll="artifacts">See sample artifacts</a>
            <div class="hero-caption">Demo uses mock data. Wire to the API later.</div>
          </div>

          <div class="hero-shot">
            <div class="shot">
              <div class="shot-bar">
                <div class="shot-dots"><span></span><span></span><span></span></div>
                <div class="shot-title">Run overview</div>
                <div class="shot-meta">Evidence review</div>
              </div>
              <div class="shot-body">
                <div class="shot-sidebar">
                  <div class="shot-item active">Runs</div>
                  <div class="shot-item">Domains</div>
                  <div class="shot-item">Evidence</div>
                  <div class="shot-item">Actions</div>
                </div>
                <div class="shot-main">
                  <div class="shot-summary">
                    <span>Latest run: Mar 14, 2026 09:12</span>
                    <span>Artifacts: report.docx + report_text_extract.txt + support_bundle.zip</span>
                  </div>
                  <table class="shot-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Report</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Mar 14</td>
                        <td><span class="chip warn">WARN</span></td>
                        <td>report.docx</td>
                        <td>support_bundle.zip</td>
                      </tr>
                      <tr>
                        <td>Mar 12</td>
                        <td><span class="chip pass">PASS</span></td>
                        <td>report.docx</td>
                        <td>support_bundle.zip</td>
                      </tr>
                      <tr>
                        <td>Mar 05</td>
                        <td><span class="chip fail">FAIL</span></td>
                        <td>report.docx</td>
                        <td>support_bundle.zip</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="shot-mobile">
              <div class="metric-card">
                <div class="metric-label">Latest status</div>
                <div class="metric-value">WARN</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Artifacts</div>
                <div class="metric-value">report.docx, report_text_extract.txt, support_bundle.zip</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Run trail</div>
                <div class="metric-value">PASS, WARN, FAIL with timestamps</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="container trust-strip" id="how-it-works">
        <div class="trust-item">Evidence bundle, manifests, and retention policies</div>
        <div class="trust-item">Designed for SOC 2 and ISO 27001 questionnaires</div>
        <div class="trust-item">Single source of truth for report outputs</div>
      </div>

      <div class="container section" id="artifacts">
        <div class="section-title">Sample artifacts</div>
        <div class="artifact-grid">
          <div class="artifact-card">
            <div class="artifact-name">report.docx</div>
            <div class="artifact-desc">Executive report with coverage and evidence references.</div>
          </div>
          <div class="artifact-card">
            <div class="artifact-name">report_text_extract.txt</div>
            <div class="artifact-desc">Machine-readable extract for review and parsing.</div>
          </div>
          <div class="artifact-card">
            <div class="artifact-name">support_bundle.zip</div>
            <div class="artifact-desc">Evidence bundle with manifests and paths.</div>
          </div>
        </div>
      </div>

      <div class="container section">
        <div class="section-title">Built for evidence</div>
        <div class="proof-grid">
          <div class="proof-card">
            <h3>Faster audit prep</h3>
            <p>Artifacts already packaged and ready to share.</p>
          </div>
          <div class="proof-card">
            <h3>Repeatable runs</h3>
            <p>Manifest and timestamps for every run.</p>
          </div>
          <div class="proof-card">
            <h3>Fewer back-and-forths</h3>
            <p>Evidence references auditors can follow.</p>
          </div>
        </div>
        <div class="trust-row">
          <span>No raw telemetry sharing</span>
          <span>Artifact retention controls</span>
          <span>Exportable evidence bundle</span>
        </div>
      </div>

      <div class="container footer">
        <div class="row" style="justify-content: space-between;">
          <div>Copyright ${new Date().getFullYear()} Polaris Security Portal</div>
          <div class="row">
            <a class="text-link" href="mailto:security@polaris.example">Security</a>
            <button class="btn small" id="theme-toggle" title="Toggle theme">Theme</button>
          </div>
        </div>
      </div>
    `;

    wireCommonHandlers();
  }

  function renderLogin(app) {
    app.innerHTML = `
      ${renderNav({
        rightHtml: `<a class="btn ghost" href="#/">Back</a>`
      })}
      <div class="container hero">
        <div class="card pad" style="max-width:520px; margin: 0 auto;">
          <div style="font-weight:780; font-size:20px;">Sign in</div>
          <div class="small">Demo auth now. Later: SSO or magic link.</div>

          <div class="hr"></div>

          <label class="label" for="email">Email</label>
          <input class="input" id="email" type="email" placeholder="you@company.com" autocomplete="email" />

          <label class="label" for="password">Password</label>
          <input class="input" id="password" type="password" placeholder="Minimum 6 characters" autocomplete="current-password" />

          <div class="row" style="margin-top:14px; justify-content: space-between;">
            <button class="btn primary" id="login-btn">Sign in</button>
            <button class="btn" id="demo-btn" title="Use demo credentials">Use demo</button>
          </div>

          <div class="hr"></div>

          <div class="small">
            Demo tip: email must include "@", password must be 6+ characters.
          </div>
        </div>
      </div>
      <div class="container footer">
        <div class="mono">Auth token stored in localStorage for this demo.</div>
      </div>
    `;

    wireCommonHandlers();

    const loginBtn = qs("#login-btn");
    const demoBtn = qs("#demo-btn");
    const emailEl = qs("#email");
    const passEl = qs("#password");

    demoBtn.addEventListener("click", () => {
      emailEl.value = "drew@example.com";
      passEl.value = "password";
      toast("Demo credentials filled.");
    });

    loginBtn.addEventListener("click", async () => {
      loginBtn.disabled = true;
      loginBtn.textContent = "Signing in...";
      try {
        const email = emailEl.value.trim();
        const password = passEl.value;
        const res = await api.login({ email, password });
        setToken(res.token);
        state.me = await api.me();
        toast("Signed in.");
        location.hash = "#/app";
      } catch (e) {
        toast(e.message || "Login failed.");
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      }
    });
  }

  function renderAppShell(app, renderInner) {
    app.innerHTML = `
      ${renderNav({
        rightHtml: `
          <span class="pill">
            <span class="mono" id="me-pill">Loading…</span>
          </span>
          <a class="btn" href="#/app/settings">Settings</a>
          <button class="btn danger" id="logout-btn">Logout</button>
        `
      })}
      <div class="container section">
        <div class="card split">
          <div class="sidebar">
            <div style="font-weight:780; font-size:16px;">Portal</div>
            <div class="small">Runs, reports, and artifacts</div>

            <div class="hr"></div>

            <div class="tabbar">
              <a class="tab ${location.hash.startsWith("#/app") && !location.hash.includes("settings") ? "active" : ""}" href="#/app">Dashboard</a>
              <a class="tab ${location.hash.includes("settings") ? "active" : ""}" href="#/app/settings">Settings</a>
              <a class="tab" href="#/">Landing</a>
            </div>

            <div class="kpi">
              <div class="label">Status</div>
              <div class="value" id="status-value">Loading…</div>
              <div class="hint" id="status-hint">Fetching your runs</div>
            </div>

            <div class="hr"></div>

            <div class="small">
              Next wiring step:
              <div class="mono" style="margin-top:8px;">
                GET /api/runs<br/>
                GET /api/runs/:id
              </div>
            </div>
          </div>

          <div class="content" id="shell-main"></div>
        </div>
      </div>

      <div class="container footer">
        <div class="row" style="justify-content: space-between;">
          <div class="small">Portal demo UI</div>
          <div class="row">
            <button class="btn small" id="theme-toggle" title="Toggle theme">Theme</button>
            <div class="mono">v0.1</div>
          </div>
        </div>
      </div>
    `;

    wireCommonHandlers();
    wireAuthedHandlers();

    hydrateMePill();
    hydrateSidebarStatus();

    renderInner?.();
  }

  async function hydrateMePill() {
    const pill = qs("#me-pill");
    if (!pill) return;

    try {
      if (!state.me) state.me = await api.me();
      pill.textContent = `${state.me.name} · ${state.me.org} · ${state.me.role}`;
    } catch {
      pill.textContent = "Signed in";
    }
  }

  async function hydrateSidebarStatus() {
    const v = qs("#status-value");
    const h = qs("#status-hint");
    if (!v || !h) return;

    try {
      if (!state.runs.length) state.runs = await api.runs();
      const latest = state.runs[0];
      v.textContent = `Latest: ${latest.status}`;
      h.textContent = `${latest.org_slug} · ${formatDate(latest.created_at)}`;
    } catch {
      v.textContent = "Unknown";
      h.textContent = "Could not load runs";
    }
  }

  async function renderDashboard(root) {
    if (!root) return;

    root.innerHTML = `
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <div>
          <div style="font-weight:820; font-size:20px;">Dashboard</div>
          <div class="small">Your recent report runs and artifacts</div>
        </div>

        <div class="row">
          <button class="btn" id="refresh-btn">Refresh</button>
          <button class="btn primary" id="new-run-btn" title="Demo only">New run</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row">
        <span class="badge">Status: PASS / WARN / FAIL</span>
        <span class="badge">Artifacts: report.docx, report_text_extract.txt, support_bundle.zip</span>
      </div>

      <div class="hr"></div>

      <div class="card" style="overflow:hidden;">
        <table class="table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Org</th>
              <th>Label</th>
              <th>Status</th>
              <th>Domains validated</th>
              <th>Overall risk</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="runs-tbody">
            <tr><td colspan="7" class="small">Loading runs…</td></tr>
          </tbody>
        </table>
      </div>
    `;

    qs("#refresh-btn").addEventListener("click", async () => {
      toast("Refreshing runs…");
      state.runs = [];
      await loadRuns();
      renderDashboard(root);
    });

    qs("#new-run-btn").addEventListener("click", () => {
      toast("Demo: new runs are created by your backend pipeline.");
    });

    await loadRuns();
    paintRunsTable();
  }

  async function loadRuns() {
    state.runs = await api.runs();
    state.runById.clear();
    for (const r of state.runs) state.runById.set(r.id, r);
  }

  function paintRunsTable() {
    const tbody = qs("#runs-tbody");
    if (!tbody) return;

    tbody.innerHTML = state.runs.map((r) => {
      const badge = statusBadge(r.status);
      const dv = `${r.summary.domains_validated}/${r.summary.domains_total}`;
      return `
        <tr>
          <td><a href="#/app/runs/${encodeURIComponent(r.id)}" class="mono">${escapeHtml(r.id)}</a></td>
          <td>${escapeHtml(r.org_slug)}</td>
          <td>${escapeHtml(r.label)}</td>
          <td>${badge}</td>
          <td>${escapeHtml(dv)}</td>
          <td>${riskBadge(r.summary.overall_risk)}</td>
          <td class="small">${escapeHtml(formatDate(r.created_at))}</td>
        </tr>
      `;
    }).join("");
  }

  function statusBadge(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PASS") return `<span class="badge good">PASS</span>`;
    if (s === "WARN") return `<span class="badge warn">WARN</span>`;
    return `<span class="badge bad">FAIL</span>`;
  }

  function riskBadge(risk) {
    const r = String(risk || "").toLowerCase();
    if (r.includes("critical")) return `<span class="badge bad">Critical</span>`;
    if (r.includes("high")) return `<span class="badge warn">High</span>`;
    return `<span class="badge">Medium</span>`;
  }

  async function renderRunDetails(root, runId) {
    if (!root) return;

    const id = decodeURIComponent(runId);

    root.innerHTML = `
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <div>
          <div style="font-weight:820; font-size:20px;">Run details</div>
          <div class="small mono">${escapeHtml(id)}</div>
        </div>
        <div class="row">
          <a class="btn" href="#/app">Back</a>
          <button class="btn" id="copy-id">Copy ID</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="tabbar">
        <a class="tab active" href="#/app/runs/${encodeURIComponent(id)}">Overview</a>
      </div>

      <div id="run-details-body">
        <div class="small">Loading…</div>
      </div>
    `;

    qs("#copy-id").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(id);
        toast("Run ID copied.");
      } catch {
        toast("Could not copy. Your browser blocked clipboard access.");
      }
    });

    let run;
    try {
      run = await api.run(id);
    } catch (e) {
      qs("#run-details-body").innerHTML = `<div class="badge bad">Error: ${escapeHtml(e.message || "Failed to load run.")}</div>`;
      return;
    }

    const body = qs("#run-details-body");
    const dv = `${run.summary.domains_validated}/${run.summary.domains_total}`;

    body.innerHTML = `
      <div class="grid-2">
        <div class="kpi">
          <div class="label">Status</div>
          <div class="value">${run.status}</div>
          <div class="hint">${escapeHtml(run.org_slug)} · ${escapeHtml(run.label)}</div>
        </div>
        <div class="kpi">
          <div class="label">Domains validated</div>
          <div class="value">${escapeHtml(dv)}</div>
          <div class="hint">Must match domain table logic</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row" style="justify-content: space-between;">
        <div>
          <div style="font-weight:780;">Artifacts</div>
          <div class="small">In production: signed download links</div>
        </div>
        <span class="badge">Created: ${escapeHtml(formatDate(run.created_at))}</span>
      </div>

      <div class="row" style="margin-top:10px;">
        <a class="btn" href="${run.links.docx_url}" onclick="return false;">Download report.docx</a>
        <a class="btn" href="${run.links.text_extract_url}" onclick="return false;">Download report_text_extract.txt</a>
        <a class="btn" href="${run.links.support_bundle_url}" onclick="return false;">Download support_bundle.zip</a>
      </div>

      <div class="hr"></div>

      <div class="row" style="justify-content: space-between;">
        <div>
          <div style="font-weight:780;">Security Domain Coverage</div>
          <div class="small">Transport + Validation + Confidence + Status</div>
        </div>
        <span class="badge">${statusBadge(run.status)} ${riskBadge(run.summary.overall_risk)}</span>
      </div>

      <div class="card" style="margin-top:10px; overflow:hidden;">
        <table class="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Transport</th>
              <th>Validation</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${run.domains.map(d => `
              <tr>
                <td>${escapeHtml(d.name)}</td>
                <td>${escapeHtml(d.transport)}</td>
                <td>${escapeHtml(d.validation)}</td>
                <td>${escapeHtml(d.confidence)}</td>
                <td>${escapeHtml(d.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <div style="font-weight:780;">Recommended Actions</div>
      <div class="small">This is what customers actually want: what to do next.</div>

      <div class="card" style="margin-top:10px; overflow:hidden;">
        <table class="table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Action</th>
              <th>Owner</th>
              <th>Timeline</th>
              <th>Effort</th>
            </tr>
          </thead>
          <tbody>
            ${run.actions.map(a => `
              <tr>
                <td class="mono">${escapeHtml(a.priority)}</td>
                <td>${escapeHtml(a.title)}</td>
                <td>${escapeHtml(a.owner)}</td>
                <td>${escapeHtml(a.timeline)}</td>
                <td class="mono">${escapeHtml(a.effort)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSettings(root) {
    if (!root) return;

    const currentTheme = document.documentElement.dataset.theme || "dark";

    root.innerHTML = `
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <div>
          <div style="font-weight:820; font-size:20px;">Settings</div>
          <div class="small">Portal preferences and account</div>
        </div>
        <a class="btn" href="#/app">Back</a>
      </div>

      <div class="hr"></div>

      <div class="grid-2">
        <div class="kpi">
          <div class="label">Theme</div>
          <div class="value">${escapeHtml(currentTheme)}</div>
          <div class="hint">Toggle from the top-right button</div>
        </div>
        <div class="kpi">
          <div class="label">Auth</div>
          <div class="value">Token</div>
          <div class="hint mono">${escapeHtml(getToken() || "none")}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="card pad">
        <div style="font-weight:780;">API wiring checklist</div>
        <div class="small">When you’re ready, replace mock API calls in app.js.</div>
        <div class="hr"></div>
        <div class="mono">
          GET /api/me<br/>
          GET /api/runs<br/>
          GET /api/runs/:id<br/>
          GET /api/runs/:id/artifacts (or signed URLs)<br/>
        </div>
      </div>
    `;
  }

  function renderNotFound(app) {
    app.innerHTML = `
      ${renderNav({
        rightHtml: `<a class="btn" href="#/">Home</a>`
      })}
      <div class="container hero">
        <div class="card pad">
          <div style="font-weight:820; font-size:20px;">Not found</div>
          <div class="small">That route doesn’t exist.</div>
          <div class="hr"></div>
          <a class="btn primary" href="#/">Go home</a>
        </div>
      </div>
    `;
    wireCommonHandlers();
  }

  function wireCommonHandlers() {
    const themeBtn = qs("#theme-toggle");
    if (themeBtn) {
      themeBtn.onclick = () => {
        const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        setTheme(t);
        toast(`Theme set to ${t}.`);
        route();
      };
    }

    const scrollLinks = qsa("[data-scroll]");
    scrollLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = link.getAttribute("data-scroll");
        if (!target) return;
        event.preventDefault();
        const doScroll = () => {
          const el = qs(`#${target}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        if (location.hash !== "#/" && location.hash !== "") {
          location.hash = "#/";
          setTimeout(doScroll, 50);
        } else {
          doScroll();
        }
      });
    });
  }

  function wireAuthedHandlers() {
    const logoutBtn = qs("#logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        setToken("");
        state.me = null;
        toast("Logged out.");
        location.hash = "#/";
      };
    }
  }

  // Boot: if user is authed and hits /app, let it work.
  function normalizeInitialRoute() {
    if (!location.hash) {
      location.hash = "#/";
      return;
    }
    // If someone goes directly to #/app while not authed, we route() will push login UI.
  }

  window.addEventListener("hashchange", route);

  initTheme();
  normalizeInitialRoute();

  // If authed, prefetch runs in background for snappy dashboard.
  (async () => {
    try {
      if (isAuthed()) {
        state.me = await api.me();
        state.runs = await api.runs();
        for (const r of state.runs) state.runById.set(r.id, r);
      }
    } catch {
      // ignore
    } finally {
      route();
    }
  })();
})();

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
    const publicRoutes = new Set(["", "/", "terms", "privacy"]);
    const isPublic = path === "/" || path === "" || publicRoutes.has(base);
    if (!isPublic && !isAuthed()) {
      renderLogin(app);
      return;
    }

    // Layout:
    if (path === "/" || path === "") {
      renderLanding(app);
      return;
    }

    if (base === "terms") {
      renderTerms(app);
      return;
    }

    if (base === "privacy") {
      renderPrivacy(app);
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
              <span>Evidence-backed reporting</span>
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
            <h1 class="h-title">Stop rebuilding audit evidence every quarter.</h1>
            <p class="h-sub">
              Every run is reproducible, timestamped, and auditor-ready with bundled artifacts and evidence keys.
            </p>
            <div class="accent-rule" aria-hidden="true"></div>
            <div class="hero-chips">
              <div class="chip-card">
                <div class="chip-title">Artifacts included</div>
                <div class="chip-sub">Eliminate manual packaging with <span class="mono">report.docx</span>, <span class="mono">report_text_extract.txt</span>, and <span class="mono">support_bundle.zip</span>.</div>
              </div>
              <div class="chip-card">
                <div class="chip-title">Traceable history</div>
                <div class="chip-sub">Timestamps, manifests, and run metadata for every cycle.</div>
              </div>
              <div class="chip-card">
                <div class="chip-title">Audit evidence keys</div>
                <div class="chip-sub">Evidence paths mapped to SOC 2 and ISO questionnaires.</div>
              </div>
            </div>
            <div class="cta-row">
              <a class="btn primary" href="#/app">View demo</a>
              <a class="btn ghost" href="#/" data-scroll="artifacts">See sample artifacts</a>
            </div>
            <div class="hero-caption">Demo uses mock data. Wire to the API later.</div>
            <div class="trusted-row">
              <span>Built for</span>
              <span class="trust-pill">Auditor workflows</span>
              <span class="trust-pill">Evidence retention</span>
              <span class="trust-pill">Multi-tenant reporting</span>
              <span class="trust-pill">M&amp;A rollups</span>
            </div>
          </div>

          <div class="hero-shot">
            <div class="device-frame">
              <div class="device-tag">Latest run: WARN with artifacts</div>
              <div class="shot">
                <div class="shot-bar">
                  <div class="shot-dots"><span></span><span></span><span></span></div>
                  <div class="shot-title">Evidence-ready report</div>
                  <div class="shot-meta">Artifacts bundled</div>
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
                      <span>Artifacts: 3 with manifest</span>
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
                        <tr class="shot-highlight">
                          <td>Mar 14</td>
                          <td><span class="chip warn">WARN</span></td>
                          <td>report.docx</td>
                          <td><span class="highlight-pill">support_bundle.zip</span></td>
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

      <div class="container section" id="artifacts" data-animate>
        <div class="section-title">What you hand an auditor</div>
        <div class="artifact-grid">
          <div class="artifact-card">
            <div class="artifact-icon">DOCX</div>
            <div class="artifact-name">report.docx</div>
            <div class="artifact-desc">Executive narrative with coverage and findings.</div>
            <div class="artifact-meta">Includes coverage summary and domain notes.</div>
          </div>
          <div class="artifact-card">
            <div class="artifact-icon">TXT</div>
            <div class="artifact-name">report_text_extract.txt</div>
            <div class="artifact-desc">Searchable extraction for review and parsing.</div>
            <div class="artifact-meta">Plain-text mirror for redlines and QA.</div>
          </div>
          <div class="artifact-card">
            <div class="artifact-icon">ZIP</div>
            <div class="artifact-name">support_bundle.zip</div>
            <div class="artifact-desc">Evidence bundle with manifest and paths.</div>
            <div class="artifact-meta">manifest.json, evidence paths, run metadata.</div>
          </div>
        </div>
        <div class="section-note">Everything is timestamped and re-generatable.</div>
      </div>

      <div class="container section" data-animate>
        <div class="section-title">Evidence keys preview</div>
        <div class="proof-block">
          <div class="proof-heading">Compliance mappings are traceable in <span class="mono">compliance_evidence.json</span> and <span class="mono">compliance_mapping.xlsx</span>.</div>
          <pre class="code-block">frameworks.soc2.controls.CC6.1.evidence\nframeworks.iso27001_2022.controls.A.5.1.evidence\nframeworks.soc2.controls.CC7.2.evidence\nruns.latest.manifest.artifacts.support_bundle</pre>
        </div>
      </div>

      <div class="container section" id="how-it-works" data-animate>
        <div class="section-title">How it works</div>
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div>
              <div class="step-title">Collect signals</div>
              <div class="step-desc">Connect sources and capture evidence paths.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div>
              <div class="step-title">Generate report + bundle</div>
              <div class="step-desc">Artifacts are packaged with timestamps and manifests.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div>
              <div class="step-title">Share portal link</div>
              <div class="step-desc">Stakeholders review one source of truth.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="container footer">
        <div class="row" style="justify-content: space-between;">
          <div>Copyright ${new Date().getFullYear()} Polaris Consulting, LLC</div>
          <div class="row">
            <a class="footer-link" href="#/terms">Terms</a>
            <a class="footer-link" href="#/privacy">Privacy</a>
            <a class="footer-link" href="mailto:info@polarisconsulting.net">Contact</a>
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

  function renderTerms(app) {
    const termsHtml = [
      renderNav({ rightHtml: '<a class="btn ghost" href="#/">Home</a>' }),
      '<div class="container section" style="max-width:820px; margin: 0 auto;">',
      '<a href="#/" class="small" style="color: var(--accent-400);">&larr; Back to Home</a>',
      '<h1 style="font-weight:820; font-size:28px; margin-top:16px;">Terms of Service</h1>',
      '<div class="small" style="margin-bottom:32px;">Last updated: February 14, 2026</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">1. Agreement to Terms</div>',
      '<p class="small">These Terms of Service (\u201cTerms\u201d) constitute a legally binding agreement between you (\u201cCustomer,\u201d \u201cClient,\u201d \u201cyou,\u201d or \u201cyour\u201d) and Polaris Consulting, LLC (\u201cPolaris,\u201d \u201cProvider,\u201d \u201cwe,\u201d \u201cus,\u201d or \u201cour\u201d), a company based in Los Angeles, California.</p>',
      '<p class="small" style="margin-top:8px;">By accessing or using our website at polarisconsulting.net and our security assessment platform (collectively, the \u201cServices\u201d), you agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use our Services.</p>',
      '<p class="small" style="margin-top:8px;">If you are using our Services on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.</p>',
      '<p class="small" style="margin-top:8px;">Customers who have executed a separate Master Services Agreement (\u201cMSA\u201d) with Polaris are governed by the terms of that MSA. In the event of any conflict between these Terms and an executed MSA, the MSA shall control.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">2. Description of Services</div>',
      '<p class="small">Polaris operates a cybersecurity assessment and compliance evaluation platform and offers professional security consulting services. Our Services may include, but are not limited to:</p>',
      '<ul class="small" style="margin-top:8px; padding-left:20px;"><li>Security posture assessments of Microsoft 365 and Azure environments</li><li>Compliance evaluations against industry frameworks including CMMC 2.0, CIS Controls v8, ISO 27001, NIST CSF, and SOC 2</li><li>Generation of security and compliance reports, including IT operations briefs, executive summaries, and gap analyses</li><li>CMMC Level 2 gap analysis with SPRS scoring</li><li>Managed IT services, ongoing security monitoring, and periodic reassessments (where contracted)</li><li>Access to the platform for dashboard visibility, report retrieval, and compliance tracking</li></ul>',
      '<p class="small" style="margin-top:8px;">The specific scope, schedule, and deliverables for each engagement may be set forth in a Statement of Work or service agreement between the parties.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">3. Read-Only Access and Client Environment</div>',
      '<p class="small">Our platform connects to your Microsoft 365 tenant using <strong>read-only OAuth permissions</strong> through the Microsoft Graph API. Unless a separate agreement specifically authorizes remediation work or configuration changes, our access to your environment is limited to read-only operations.</p>',
      '<ul class="small" style="margin-top:8px; padding-left:20px;"><li>We <strong>shall not modify, delete, or alter</strong> any of your configurations, policies, or data without prior written authorization</li><li>We request only the minimum permissions necessary to perform the contracted Services</li><li>You may revoke our access at any time through your Azure AD portal by removing the enterprise application</li><li>Revocation of permissions required for the Services may impact our ability to deliver assessments but shall not constitute a breach by Polaris</li></ul>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">4. Client Obligations</div>',
      '<p class="small">As a Customer, you are responsible for:</p>',
      '<ul class="small" style="margin-top:8px; padding-left:20px;"><li>Maintaining the security of your Azure AD credentials and account access</li><li>Granting appropriate OAuth permissions necessary for security assessments</li><li>Ensuring you have the authority to connect your organization\u2019s Microsoft 365 tenant and that such access does not violate any agreement, law, or regulation to which you are subject</li><li>Providing timely access, information, and cooperation reasonably necessary for us to perform the Services</li><li>Promptly notifying us of any material changes to your environment that may affect the Services</li><li>Keeping your account information accurate and up to date</li></ul>',
      '<p class="small" style="margin-top:8px;"><strong>Implementation responsibility:</strong> Unless a separate agreement specifically includes remediation work, you are solely responsible for implementing any recommendations, remediations, or configuration changes identified in our deliverables. Our role is advisory; the decision to implement, partially implement, or decline any recommendation rests entirely with you.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">5. Intellectual Property</div>',
      '<p class="small"><strong>5.1 Platform Ownership:</strong> Polaris retains all right, title, and interest in and to the platform, its proprietary methodologies, assessment frameworks, software, tools, templates, and any pre-existing intellectual property.</p>',
      '<p class="small" style="margin-top:8px;"><strong>5.2 Deliverable License:</strong> Upon payment in full, we grant you a non-exclusive, non-transferable, perpetual license to use the deliverables for your internal business purposes. You may share deliverables with your auditors, regulators, and legal counsel as reasonably necessary.</p>',
      '<p class="small" style="margin-top:8px;"><strong>5.3 Customer Data Ownership:</strong> You retain all right, title, and interest in and to your data.</p>',
      '<p class="small" style="margin-top:8px;"><strong>5.4 Aggregated Data:</strong> We may use aggregated, anonymized, and de-identified data to improve our platform and develop benchmarks, provided it cannot reasonably identify you.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">6. Important Disclaimers</div>',
      '<p class="small" style="font-weight:700;">BY USING OUR SERVICES, YOU ACKNOWLEDGE AND AGREE TO THE FOLLOWING:</p>',
      '<p class="small" style="margin-top:12px;"><strong>6.1 No Guarantee of Security:</strong> The Services are designed to assess, evaluate, and improve your security posture, but Polaris does not and cannot guarantee that your systems will be free from vulnerabilities, security breaches, or cyberattacks. No security assessment can eliminate all risk.</p>',
      '<p class="small" style="margin-top:8px;"><strong>6.2 No Guarantee of Compliance:</strong> Our compliance evaluations \u2014 including those referencing CMMC 2.0, CIS Controls v8, ISO 27001, NIST CSF, SOC 2, or any other framework \u2014 are <strong>advisory in nature</strong>. They do not constitute a certification, attestation, or guarantee of compliance. SPRS scores and CMMC readiness assessments are estimates and may differ from official government assessments.</p>',
      '<p class="small" style="margin-top:8px;"><strong>6.3 Point-in-Time Assessment:</strong> All assessments reflect the state of your environment at the time of the assessment. Polaris is not responsible for changes that occur after an assessment is completed.</p>',
      '<p class="small" style="margin-top:8px;"><strong>6.4 Advisory Role Only:</strong> Our recommendations are professional advice. You are solely responsible for evaluating and implementing any recommendations.</p>',
      '<p class="small" style="margin-top:8px;"><strong>6.5 No Warranty of Completeness:</strong> No assessment methodology can identify every vulnerability, misconfiguration, or compliance gap.</p>',
      '<p class="small" style="margin-top:8px; font-weight:700;"><strong>6.6 Disclaimer of Other Warranties:</strong> EXCEPT AS EXPRESSLY SET FORTH IN THESE TERMS, POLARIS DISCLAIMS ALL OTHER WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT. THE SERVICES AND PLATFORM ARE PROVIDED \u201cAS IS.\u201d</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">7. Limitation of Liability</div>',
      '<p class="small" style="font-weight:700;"><strong>7.1 Consequential Damages Exclusion:</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF REVENUE, LOSS OF PROFITS, LOSS OF DATA, BUSINESS INTERRUPTION, COST OF SUBSTITUTE SERVICES, OR REGULATORY FINES.</p>',
      '<p class="small" style="margin-top:8px; font-weight:700;"><strong>7.2 Liability Cap:</strong> POLARIS\u2019S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO POLARIS DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>',
      '<p class="small" style="margin-top:8px;"><strong>7.3 Exceptions:</strong> The limitations in 7.1 and 7.2 shall not apply to: (a) breaches of confidentiality or data protection obligations; (b) indemnification obligations under Section 8; (c) fraud, gross negligence, or willful misconduct; or (d) your obligation to pay fees owed.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">8. Indemnification</div>',
      '<p class="small"><strong>8.1 Client Indemnification:</strong> You agree to indemnify, defend, and hold harmless Polaris from claims arising out of: (a) your use or misuse of deliverables; (b) your failure to implement recommendations; (c) your misrepresentation of compliance status using our deliverables; (d) claims from your environment not caused by Polaris\u2019s breach; or (e) your violation of any law or regulation.</p>',
      '<p class="small" style="margin-top:8px;"><strong>8.2 Provider Indemnification:</strong> Polaris shall indemnify you from claims arising out of: (a) Polaris\u2019s gross negligence or willful misconduct; (b) Polaris\u2019s breach of confidentiality or data protection obligations; or (c) claims that the platform infringes a third party\u2019s intellectual property rights.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">9. Data Handling and Confidentiality</div>',
      '<p class="small">Our collection, use, and protection of your data is governed by our <a href="#/privacy" style="color: var(--accent-400);">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>',
      '<p class="small" style="margin-top:8px;">Your security assessment results, vulnerability findings, compliance status, and related deliverables constitute your confidential information. We shall not disclose such information to any third party without your written consent, except in aggregated, anonymized form.</p>',
      '<p class="small" style="margin-top:8px;">Data is encrypted in transit (TLS 1.2 or higher) and at rest. We collect and retain only the data reasonably necessary to perform the Services.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">10. Service Availability</div>',
      '<p class="small">We strive to maintain high availability but do not guarantee uninterrupted service. The Services may be temporarily unavailable due to scheduled maintenance, unplanned outages, third-party service disruptions (Microsoft Azure, Microsoft Graph API), or force majeure events.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">11. Term and Termination</div>',
      '<p class="small">Either party may terminate with 30 days\u2019 written notice to <a href="mailto:info@polarisconsulting.net" style="color: var(--accent-400);">info@polarisconsulting.net</a>. Upon termination: you shall pay all fees due; we will deliver completed deliverables; your platform access will be deactivated; client data will be securely deleted within 90 days.</p>',
      '<p class="small" style="margin-top:8px;">Sections 5, 6, 7, 8, 9, and 13 shall survive termination.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">12. Governing Law and Dispute Resolution</div>',
      '<p class="small">These Terms shall be governed by the laws of the State of California. Disputes shall be subject to the exclusive jurisdiction of the state and federal courts in Los Angeles County, California.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">13. General Provisions</div>',
      '<p class="small"><strong>Modifications:</strong> We may modify these Terms at any time with notice. Continued use constitutes acceptance.</p>',
      '<p class="small" style="margin-top:8px;"><strong>Severability:</strong> Invalid provisions shall not affect the remaining Terms.</p>',
      '<p class="small" style="margin-top:8px;"><strong>Entire Agreement:</strong> These Terms, our Privacy Policy, and any executed MSA constitute the entire agreement.</p>',
      '<p class="small" style="margin-top:8px;"><strong>Independent Contractor:</strong> Polaris is an independent contractor. No employment, partnership, or agency relationship is created.</p>',
      '<p class="small" style="margin-top:8px;"><strong>Assignment:</strong> You may not assign these Terms without our written consent.</p>',
      '</div>',

      '<div class="card pad">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">14. Contact Us</div>',
      '<p class="small">If you have any questions about these Terms, please contact us:</p>',
      '<div style="margin-top:12px; padding:16px; border:1px solid var(--border); border-radius:8px;">',
      '<div style="font-weight:700;">Polaris Consulting, LLC</div>',
      '<div class="small" style="margin-top:4px;">Los Angeles, California</div>',
      '<div class="small" style="margin-top:4px;">Email: <a href="mailto:info@polarisconsulting.net" style="color: var(--accent-400);">info@polarisconsulting.net</a></div>',
      '</div></div>',

      '</div>',
      '<div class="container footer"><div class="row" style="justify-content: space-between;"><div>Copyright ', String(new Date().getFullYear()), ' Polaris Consulting, LLC</div><div class="row"><a class="footer-link" href="#/terms">Terms</a><a class="footer-link" href="#/privacy">Privacy</a><button class="btn small" id="theme-toggle" title="Toggle theme">Theme</button></div></div></div>',
    ].join("\n");
    app.innerHTML = termsHtml;
    wireCommonHandlers();
  }

  function renderPrivacy(app) {
    const privacyHtml = [
      renderNav({ rightHtml: '<a class="btn ghost" href="#/">Home</a>' }),
      '<div class="container section" style="max-width:820px; margin: 0 auto;">',
      '<a href="#/" class="small" style="color: var(--accent-400);">&larr; Back to Home</a>',
      '<h1 style="font-weight:820; font-size:28px; margin-top:16px;">Privacy Policy</h1>',
      '<div class="small" style="margin-bottom:32px;">Last updated: February 14, 2026</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">1. Introduction</div>',
      '<p class="small">Polaris Consulting, LLC (\u201cPolaris,\u201d \u201cwe,\u201d \u201cus,\u201d or \u201cour\u201d) is a cybersecurity assessment and managed IT services company based in Los Angeles, California. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at polarisconsulting.net and use our security assessment platform (collectively, the \u201cServices\u201d).</p>',
      '<p class="small" style="margin-top:8px;">By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.</p>',
      '<p class="small" style="margin-top:8px;">Customers who have executed a Master Services Agreement (\u201cMSA\u201d) with Polaris are also subject to the data protection and confidentiality provisions of that agreement. In the event of a conflict, the MSA shall control.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">2. Information We Collect</div>',
      '<p class="small"><strong>2.1 Information You Provide Directly:</strong> Name, email address, phone number, company name, company size, and message content submitted via contact forms.</p>',
      '<p class="small" style="margin-top:8px;"><strong>2.2 Client Environment Data (OAuth Consent):</strong> When you connect your Microsoft 365 tenant, we collect read-only data including tenant configuration, Azure AD settings, security policies, device compliance status, email security settings, and Microsoft Secure Score data. We access this using <strong>read-only OAuth permissions</strong> through the Microsoft Graph API.</p>',
      '<p class="small" style="margin-top:8px;"><strong>2.3 Information Collected Automatically:</strong> Browser type, pages visited, referring website, device type, general geographic location, and session recordings/heatmap data via Microsoft Clarity.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">3. Analytics and Tracking</div>',
      '<p class="small">We use <strong>Microsoft Clarity</strong> for session recordings, heatmaps, and performance metrics. Clarity does not collect personally identifiable information from recordings. Sensitive input fields are automatically masked. See <a href="https://clarity.microsoft.com/terms" target="_blank" rel="noopener noreferrer" style="color: var(--accent-400);">Microsoft Clarity\u2019s Terms</a>.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">4. Cookies</div>',
      '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>',
      '<tr><td><strong>Session cookie</strong></td><td class="small">Authentication and session management</td><td class="small">Session / 24 hours</td></tr>',
      '<tr><td><strong>_clck, _clsk</strong></td><td class="small">Microsoft Clarity user identification and session tracking</td><td class="small">12 months</td></tr>',
      '<tr><td><strong>CLID</strong></td><td class="small">Microsoft Clarity session identification</td><td class="small">12 months</td></tr>',
      '<tr><td><strong>cookie_consent</strong></td><td class="small">Stores your cookie consent preference</td><td class="small">12 months</td></tr>',
      '</tbody></table></div></div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">5. How We Use Your Information</div>',
      '<p class="small">We use information to: perform security assessments, generate reports, respond to inquiries, provide support, improve our platform through analytics, maintain security, and comply with legal obligations.</p>',
      '<p class="small" style="margin-top:8px;"><strong>Data minimization:</strong> We collect and retain only the data reasonably necessary to perform the Services. We shall not use your Client Data for any purpose other than performing the Services unless expressly authorized.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">6. Third-Party Services (Subprocessors)</div>',
      '<p class="small">All subprocessors are bound by data protection obligations consistent with this Privacy Policy:</p>',
      '<ul class="small" style="margin-top:8px; padding-left:20px;"><li><strong>Microsoft Azure:</strong> Cloud hosting infrastructure</li><li><strong>Microsoft Graph API:</strong> Read-only data collection from your Microsoft 365 tenant</li><li><strong>Azure CosmosDB:</strong> Encrypted database storage</li><li><strong>Azure Blob Storage:</strong> Encrypted report storage</li><li><strong>Microsoft Clarity:</strong> Website analytics</li><li><strong>Azure AD / Azure AD B2C:</strong> Authentication and identity management</li></ul>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">7. Data Sharing and Disclosure</div>',
      '<p class="small" style="font-weight:700;">We do not sell your personal information or Client Data to third parties.</p>',
      '<p class="small" style="margin-top:8px;">Your security assessment results constitute your confidential information. We share information only with: service providers (under confidentiality obligations), when required by law (with prompt notice to you), in connection with business transfers, or with your explicit consent.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">8. Data Retention and Deletion</div>',
      '<ul class="small" style="padding-left:20px;"><li style="margin-bottom:8px;"><strong>Client Data:</strong> Securely deleted within 90 days of service termination. Earlier deletion available on written request. We certify deletion upon request.</li><li style="margin-bottom:8px;"><strong>Contact form submissions:</strong> Retained for 12 months, then purged.</li><li style="margin-bottom:8px;"><strong>Account information:</strong> Retained for the duration of your active account.</li><li><strong>Analytics data:</strong> Microsoft Clarity retains session data per their policies (typically 30 days for recordings).</li></ul>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">9. Data Security</div>',
      '<ul class="small" style="padding-left:20px;"><li><strong>Encryption in transit:</strong> TLS 1.2 or higher</li><li><strong>Encryption at rest:</strong> AES-256</li><li><strong>Web Application Firewall:</strong> Azure Front Door Premium with OWASP DRS 2.1</li><li><strong>Network isolation:</strong> Virtual network isolation and firewall rules</li><li><strong>Access controls:</strong> RBAC, MFA, and least privilege</li><li><strong>Credential protection:</strong> All tokens encrypted at rest and in transit</li></ul>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">10. Security Incident Notification</div>',
      '<p class="small">In the event of a security incident involving your data, we shall notify you in writing within <strong>seventy-two (72) hours</strong> of discovery. The notification shall include the nature of the incident, data affected, corrective actions taken or planned, and a point of contact.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">11. Your Rights (California Residents \u2014 CCPA)</div>',
      '<p class="small">California residents have the right to: <strong>know</strong> what personal information we collect; <strong>request deletion</strong> of personal information; <strong>opt out</strong> of sales (we do not sell personal information); and receive <strong>non-discriminatory</strong> treatment for exercising CCPA rights.</p>',
      '<p class="small" style="margin-top:8px;">Contact <a href="mailto:info@polarisconsulting.net" style="color: var(--accent-400);">info@polarisconsulting.net</a> to exercise your rights. We respond within 45 days.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">12. Children\u2019s Privacy</div>',
      '<p class="small">Our Services are not directed to individuals under 18. We do not knowingly collect personal information from children.</p>',
      '</div>',

      '<div class="card pad" style="margin-bottom:20px;">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">13. Changes to This Policy</div>',
      '<p class="small">We may update this Privacy Policy from time to time. Material changes will be reflected in the \u201cLast updated\u201d date and communicated via email or prominent notice. Continued use constitutes acceptance.</p>',
      '</div>',

      '<div class="card pad">',
      '<div style="font-weight:780; font-size:18px; margin-bottom:12px;">14. Contact Us</div>',
      '<p class="small">If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us:</p>',
      '<div style="margin-top:12px; padding:16px; border:1px solid var(--border); border-radius:8px;">',
      '<div style="font-weight:700;">Polaris Consulting, LLC</div>',
      '<div class="small" style="margin-top:4px;">Los Angeles, California</div>',
      '<div class="small" style="margin-top:4px;">Email: <a href="mailto:info@polarisconsulting.net" style="color: var(--accent-400);">info@polarisconsulting.net</a></div>',
      '</div></div>',

      '</div>',
      '<div class="container footer"><div class="row" style="justify-content: space-between;"><div>Copyright ', String(new Date().getFullYear()), ' Polaris Consulting, LLC</div><div class="row"><a class="footer-link" href="#/terms">Terms</a><a class="footer-link" href="#/privacy">Privacy</a><button class="btn small" id="theme-toggle" title="Toggle theme">Theme</button></div></div></div>',
    ].join("\n");
    app.innerHTML = privacyHtml;
    wireCommonHandlers();
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

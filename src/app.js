import { canvasFetch, canvasFetchAll } from "./api/canvas.js";
import { detectRoleFromPermissions } from "./api/roles.js";
import { loadRules, saveRules, loadUiState, saveUiState } from "./storage/rules.js";
export function initializeApp() {
  "use strict";

  const EXTENSION_ID = "cpt-progress-tracker";
  const TAB_ID = "cpt-progress-tab";
  const PASSING_PERCENT = 80;
  const REQUIRED_KEYWORDS = ["training", "lab", "important", "assessment"];
  const DEBUG_MODE = true;

  let appState = {
    courseId: null,
    data: null,
    modules: [],
    rules: {},
    showSettingsForModuleId: null,
    collapsed: false,
    role: "student"
  };

  function getCourseIdFromUrl() {
    const match = window.location.pathname.match(/\/courses\/(\d+)\/modules/);
    return match ? match[1] : null;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function removeExistingUI() {
    document.getElementById(EXTENSION_ID)?.remove();
    document.getElementById(TAB_ID)?.remove();
  }


  function isRequiredTitle(title) {
    const lowered = cleanText(title).toLowerCase();
    return REQUIRED_KEYWORDS.some((keyword) => lowered.includes(keyword));
  }

  function isTextHeaderItem(item) {
    const type = String(item.type || "").toLowerCase();
    return type === "subheader" || type === "text_header" || type === "contextmoduleheader";
  }

  function getAssignmentIdFromModuleItem(item) {
    if (item.assignment_id) return Number(item.assignment_id);
    if ((item.type === "Assignment" || item.type === "Quiz" || item.type === "ExternalTool") && item.content_id) {
      return Number(item.content_id);
    }
    return null;
  }


  function userIsInstructor() {
    return appState.role === "instructor";
  }

  function getRuleForModule(moduleId) {
    return appState.rules[String(moduleId)] || null;
  }

  function getRequiredItemsForModule(module, moduleItems) {
    const rule = getRuleForModule(module.id);

    if (rule && rule.mode === "custom") {
      const selectedIds = new Set((rule.requiredItemIds || []).map(String));
      return moduleItems.filter((item) => selectedIds.has(String(item.id)));
    }

    return moduleItems.filter((item) => {
      if (isTextHeaderItem(item)) return false;
      return isRequiredTitle(item.title);
    });
  }

  function createShell() {
    removeExistingUI();

    if (appState.collapsed) {
      createCollapsedTab();
      return null;
    }

    const wrapper = document.createElement("aside");
    wrapper.id = EXTENSION_ID;
    wrapper.setAttribute("aria-label", "Canvas module progress tracker");

    wrapper.innerHTML = `
      <div class="cpt-header">
        <div>
          <strong>Module Progress</strong>
          <span>Loading...</span>
        </div>
        <div class="cpt-header-actions">
          <button id="cpt-collapse" type="button" title="Collapse panel">–</button>
          <button id="cpt-refresh" type="button" title="Refresh progress">↻</button>
        </div>
      </div>
      <div class="cpt-loading">Loading Canvas progress...</div>
    `;

    document.body.appendChild(wrapper);
    bindHeaderButtons();
    return wrapper;
  }

  function createCollapsedTab() {
    const tab = document.createElement("button");
    tab.id = TAB_ID;
    tab.type = "button";
    tab.innerHTML = `<span>Progress</span><strong>›</strong>`;
    tab.title = "Open Module Progress";
    tab.addEventListener("click", async () => {
      appState.collapsed = false;
      await saveUiState(appState.courseId, appState.collapsed);
      await reloadDataAndRender();
    });
    document.body.appendChild(tab);
  }

  function bindHeaderButtons() {
    document.getElementById("cpt-refresh")?.addEventListener("click", init);
    document.getElementById("cpt-collapse")?.addEventListener("click", async () => {
      appState.collapsed = true;
      await saveUiState(appState.courseId);
      removeExistingUI();
      createCollapsedTab();
    });
  }

  function renderError(wrapper, error) {
    if (!wrapper) return;

    wrapper.innerHTML = `
      <div class="cpt-header">
        <div>
          <strong>Module Progress</strong>
          <span>Error</span>
        </div>
        <div class="cpt-header-actions">
          <button id="cpt-collapse" type="button" title="Collapse panel">–</button>
          <button id="cpt-refresh" type="button" title="Refresh progress">↻</button>
        </div>
      </div>
      <div class="cpt-error">
        <strong>Could not load Canvas API data.</strong>
        <p>${escapeHtml(error.message)}</p>
        <p>Make sure you are not in Canvas Student View.</p>
      </div>
    `;
    bindHeaderButtons();
  }

  async function getCanvasData(courseId) {
    const start = performance.now();

    const [user, course, modules] = await Promise.all([
      canvasFetch("/api/v1/users/self/profile").catch(() => ({ name: "current user" })),
      canvasFetch(`/api/v1/courses/${courseId}?include[]=permissions&include[]=enrollments`).catch(() => ({})),
      canvasFetchAll(`/api/v1/courses/${courseId}/modules?per_page=100`)
    ]);

    const role = detectRoleFromPermissions(course);
    appState.role = role;

    const moduleItemsByModuleId = {};
    await Promise.all(modules.map(async (module) => {
      moduleItemsByModuleId[module.id] =
        await canvasFetchAll(`/api/v1/courses/${courseId}/modules/${module.id}/items?per_page=100`);
    }));

    const requiredItems = modules.flatMap((module) =>
      getRequiredItemsForModule(module, moduleItemsByModuleId[module.id] || [])
    );

    const assignmentIds = Array.from(
      new Set(requiredItems.map(getAssignmentIdFromModuleItem).filter(Boolean))
    );

    const [assignments, submissions] = await Promise.all([
      assignmentIds.length
        ? Promise.all(assignmentIds.map((id) =>
            canvasFetch(`/api/v1/courses/${courseId}/assignments/${id}`).catch((error) => ({
              id,
              _cpt_error: error.message
            }))
          ))
        : Promise.resolve([]),

      assignmentIds.length
        ? Promise.all(assignmentIds.map((id) =>
            canvasFetch(`/api/v1/courses/${courseId}/assignments/${id}/submissions/self`).catch((error) => ({
              assignment_id: id,
              _cpt_error: error.message
            }))
          ))
        : Promise.resolve([])
    ]);

    return {
      user,
      course,
      role,
      modules,
      moduleItemsByModuleId,
      assignmentIds,
      assignmentMap: new Map(assignments.map((a) => [Number(a.id), a])),
      submissionMap: new Map(submissions.map((s) => [Number(s.assignment_id), s])),
      elapsedMs: Math.round(performance.now() - start)
    };
  }

  function analyzeItem(item, data) {
    const title = cleanText(item.title || "Untitled item");
    const assignmentId = getAssignmentIdFromModuleItem(item);

    if (!assignmentId) {
      return {
        id: item.id,
        title,
        type: item.type || "Unknown",
        status: "not_scorable",
        complete: false,
        percent: null,
        detail: "Required, but no assignment ID was available."
      };
    }

    const assignment = data.assignmentMap.get(Number(assignmentId));
    const submission = data.submissionMap.get(Number(assignmentId));

    if (!assignment || assignment._cpt_error) {
      return {
        id: item.id,
        title,
        type: item.type || "Unknown",
        status: "error",
        complete: false,
        percent: null,
        detail: assignment?._cpt_error || "Assignment data unavailable."
      };
    }

    if (!submission || submission._cpt_error) {
      return {
        id: item.id,
        title,
        type: item.type || "Unknown",
        status: "error",
        complete: false,
        percent: null,
        detail: submission?._cpt_error || "Submission data unavailable."
      };
    }

    const workflow = String(submission.workflow_state || "").toLowerCase();
    const submittedAt = submission.submitted_at;

    if (!submittedAt || workflow === "unsubmitted") {
      return {
        id: item.id,
        title,
        type: item.type,
        status: "missing",
        complete: false,
        percent: null,
        detail: "No submission found."
      };
    }

    const score = submission.score === null || submission.score === undefined
      ? null
      : Number(submission.score);

    if (score === null || Number.isNaN(score)) {
      return {
        id: item.id,
        title,
        type: item.type,
        status: "waiting",
        complete: false,
        percent: null,
        detail: "Submitted, waiting for grade."
      };
    }

    const pointsPossible = Number(assignment.points_possible);

    if (!pointsPossible || Number.isNaN(pointsPossible)) {
      return {
        id: item.id,
        title,
        type: item.type,
        status: "graded_no_points",
        complete: false,
        percent: null,
        detail: `Score ${score}; points possible unavailable.`
      };
    }

    const percent = Math.round((score / pointsPossible) * 100);
    const complete = percent >= PASSING_PERCENT;

    return {
      id: item.id,
      title,
      type: item.type,
      status: complete ? "passed" : "below_passing",
      complete,
      percent,
      score,
      pointsPossible,
      detail: `${score}/${pointsPossible} = ${percent}%`
    };
  }

  function analyzeModules(data) {
    return data.modules.map((module) => {
      const items = data.moduleItemsByModuleId[module.id] || [];
      const requiredItems = getRequiredItemsForModule(module, items);
      const analyzedItems = requiredItems.map((item) => analyzeItem(item, data));
      const total = analyzedItems.length;
      const complete = analyzedItems.filter((item) => item.complete).length;
      const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
      const rule = getRuleForModule(module.id);

      return {
        id: module.id,
        name: module.name,
        ruleMode: rule?.mode || "keyword",
        total,
        complete,
        percent,
        items: analyzedItems
      };
    });
  }

  function renderTracker(wrapper, courseId, data, analyzedModules) {
    if (!wrapper) return;

    const isInstructor = userIsInstructor();
    const allAnalyzedItems = analyzedModules.flatMap((m) => m.items);
    const overallTotal = allAnalyzedItems.length;
    const overallComplete = allAnalyzedItems.filter((i) => i.complete).length;
    const overallPercent = overallTotal === 0 ? 0 : Math.round((overallComplete / overallTotal) * 100);

    const waitingCount = allAnalyzedItems.filter(i => i.status === "waiting").length;
    const belowCount = allAnalyzedItems.filter(i => i.status === "below_passing").length;
    const missingCount = allAnalyzedItems.filter(i => i.status === "missing").length;
    const customRuleCount = analyzedModules.filter(m => m.ruleMode === "custom").length;

    const moduleRows = analyzedModules.map((module, index) => renderModule(module, index, isInstructor)).join("");
    const settingsPanel = isInstructor && appState.showSettingsForModuleId
      ? renderSettingsPanel(appState.showSettingsForModuleId, data)
      : "";

    const debugPanel = isInstructor && DEBUG_MODE ? `
      <details class="cpt-debug">
        <summary>Developer</summary>
        <dl>
          <div><dt>Detected Role</dt><dd>${escapeHtml(data.role)}</dd></div>
          <div><dt>API Status</dt><dd>Connected</dd></div>
          <div><dt>Modules</dt><dd>${data.modules.length}</dd></div>
          <div><dt>Custom Rule Modules</dt><dd>${customRuleCount}</dd></div>
          <div><dt>Module Items</dt><dd>${Object.values(data.moduleItemsByModuleId).flat().length}</dd></div>
          <div><dt>Required Items</dt><dd>${overallTotal}</dd></div>
          <div><dt>Passed</dt><dd>${overallComplete}</dd></div>
          <div><dt>Waiting</dt><dd>${waitingCount}</dd></div>
          <div><dt>Below 80%</dt><dd>${belowCount}</dd></div>
          <div><dt>Missing</dt><dd>${missingCount}</dd></div>
          <div><dt>Load Time</dt><dd>${data.elapsedMs} ms</dd></div>
        </dl>
      </details>
    ` : "";

    wrapper.innerHTML = `
      <div class="cpt-header">
        <div>
          <strong>Module Progress</strong>
          <span>${isInstructor ? "Instructor" : "Student"} View · ${PASSING_PERCENT}%+</span>
        </div>
        <div class="cpt-header-actions">
          <button id="cpt-collapse" type="button" title="Collapse panel">–</button>
          <button id="cpt-refresh" type="button" title="Refresh progress">↻</button>
        </div>
      </div>

      <div class="cpt-overall">
        <div class="cpt-module-topline">
          <span class="cpt-module-title">Overall Required Progress</span>
          <span class="cpt-module-percent">${overallPercent}%</span>
        </div>
        <div class="cpt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${overallPercent}">
          <div class="cpt-bar-fill" style="width: ${overallPercent}%"></div>
        </div>
        <div class="cpt-status">${overallComplete}/${overallTotal} required items passed</div>
      </div>

      <div class="cpt-summary">
        <span>Waiting: ${waitingCount}</span>
        <span>Below 80%: ${belowCount}</span>
        <span>Missing: ${missingCount}</span>
        ${isInstructor ? `<span>Custom Rules: ${customRuleCount}</span>` : ""}
      </div>

      ${settingsPanel}

      <div class="cpt-body">${moduleRows}</div>

      ${debugPanel}

      <div class="cpt-footer">
        Course ${escapeHtml(courseId)} · ${escapeHtml(data.user.name || data.user.login_id || "current user")}
      </div>
    `;

    bindEvents(wrapper);
  }

  function renderModule(module, index, isInstructor) {
    const itemList = module.items.length
      ? module.items.map(renderItem).join("")
      : `<li class="cpt-item-muted">No required items found.</li>`;

    const ruleBadge = isInstructor
      ? `<span class="cpt-rule-badge">${module.ruleMode === "custom" ? "Custom" : "Keyword"}</span>`
      : "";

    const settingsButton = isInstructor
      ? `<button class="cpt-settings-btn" type="button" data-module-id="${module.id}" title="Set requirements">⚙</button>`
      : "";

    return `
      <details class="cpt-module-row" ${index === 0 ? "open" : ""}>
        <summary>
          ${isInstructor ? `<div class="cpt-module-actions">${ruleBadge}${settingsButton}</div>` : ""}
          <div class="cpt-module-topline">
            <span class="cpt-module-title">${escapeHtml(module.name)}</span>
            <span class="cpt-module-percent">${module.percent}%</span>
          </div>
          <div class="cpt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${module.percent}">
            <div class="cpt-bar-fill" style="width: ${module.percent}%"></div>
          </div>
          <div class="cpt-status">${module.complete}/${module.total} required passed</div>
        </summary>
        <ul class="cpt-item-list">${itemList}</ul>
      </details>
    `;
  }

  function renderSettingsPanel(moduleId, data) {
    const module = data.modules.find((m) => String(m.id) === String(moduleId));
    if (!module) return "";

    const items = data.moduleItemsByModuleId[module.id] || [];
    const rule = getRuleForModule(module.id);
    const selectedIds = new Set(
      rule && rule.mode === "custom"
        ? (rule.requiredItemIds || []).map(String)
        : items.filter((item) => !isTextHeaderItem(item) && isRequiredTitle(item.title)).map((item) => String(item.id))
    );

    const itemRows = items.map((item) => {
      const isHeader = isTextHeaderItem(item);
      const checked = selectedIds.has(String(item.id)) ? "checked" : "";
      const disabled = isHeader ? "disabled" : "";
      const labelSuffix = isHeader ? "Text Header - ignored" : item.type || "Item";

      return `
        <label class="cpt-rule-item ${isHeader ? "cpt-rule-disabled" : ""}">
          <input type="checkbox" class="cpt-rule-checkbox" value="${item.id}" ${checked} ${disabled}>
          <span>
            <strong>${escapeHtml(cleanText(item.title || "Untitled item"))}</strong>
            <small>${escapeHtml(labelSuffix)}</small>
          </span>
        </label>
      `;
    }).join("");

    return `
      <section class="cpt-settings-panel" data-module-id="${module.id}">
        <div class="cpt-settings-head">
          <div>
            <strong>Requirements</strong>
            <span>${escapeHtml(module.name)}</span>
          </div>
          <button class="cpt-close-settings" type="button">×</button>
        </div>
        <p>Select the items that count toward completion for this module.</p>
        <div class="cpt-rule-list">${itemRows}</div>
        <div class="cpt-settings-actions">
          <button class="cpt-save-rules" type="button" data-module-id="${module.id}">Save Custom Rules</button>
          <button class="cpt-reset-rules" type="button" data-module-id="${module.id}">Use Keyword Rules</button>
        </div>
      </section>
    `;
  }

  function renderItem(item) {
    const statusInfo = getStatusInfo(item);
    const gradeText = item.percent === null ? "" : ` <span class="cpt-grade">(${item.percent}%)</span>`;

    return `
      <li class="${statusInfo.className}">
        <span class="cpt-icon">${statusInfo.icon}</span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>${gradeText}
          <small>${escapeHtml(statusInfo.label)} · ${escapeHtml(item.detail || "")}</small>
        </span>
      </li>
    `;
  }

  function getStatusInfo(item) {
    switch (item.status) {
      case "passed":
        return { icon: "✓", label: "Passed", className: "cpt-item-complete" };
      case "below_passing":
        return { icon: "!", label: "Below 80%", className: "cpt-item-warning" };
      case "waiting":
        return { icon: "…", label: "Waiting for grade", className: "cpt-item-waiting" };
      case "missing":
        return { icon: "○", label: "Missing", className: "cpt-item-incomplete" };
      case "not_scorable":
        return { icon: "?", label: "Not scorable", className: "cpt-item-muted" };
      default:
        return { icon: "!", label: "Error", className: "cpt-item-error" };
    }
  }

  function bindEvents(wrapper) {
    bindHeaderButtons();

    wrapper.querySelectorAll(".cpt-settings-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        appState.showSettingsForModuleId = button.dataset.moduleId;
        rerender();
      });
    });

    wrapper.querySelector(".cpt-close-settings")?.addEventListener("click", () => {
      appState.showSettingsForModuleId = null;
      rerender();
    });

    wrapper.querySelector(".cpt-save-rules")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const moduleId = button.dataset.moduleId;
      const panel = wrapper.querySelector(`.cpt-settings-panel[data-module-id="${moduleId}"]`);
      const selectedIds = Array.from(panel.querySelectorAll(".cpt-rule-checkbox:checked"))
        .map((checkbox) => checkbox.value);

      appState.rules[String(moduleId)] = {
        mode: "custom",
        requiredItemIds: selectedIds,
        updatedAt: new Date().toISOString()
      };

      await saveRules(appState.courseId, appState.rules);
      appState.showSettingsForModuleId = null;
      await reloadDataAndRender();
    });

    wrapper.querySelector(".cpt-reset-rules")?.addEventListener("click", async (event) => {
      const moduleId = event.currentTarget.dataset.moduleId;
      delete appState.rules[String(moduleId)];
      await saveRules(appState.courseId, appState.rules);
      appState.showSettingsForModuleId = null;
      await reloadDataAndRender();
    });
  }

  function rerender() {
    const wrapper = document.getElementById(EXTENSION_ID);
    appState.modules = analyzeModules(appState.data);
    renderTracker(wrapper, appState.courseId, appState.data, appState.modules);
  }

  async function reloadDataAndRender() {
    const wrapper = createShell();
    if (!wrapper && appState.collapsed) return;

    appState.data = await getCanvasData(appState.courseId);
    appState.modules = analyzeModules(appState.data);
    renderTracker(wrapper, appState.courseId, appState.data, appState.modules);
  }

  async function init() {
    const courseId = getCourseIdFromUrl();

    if (!courseId) {
      const wrapper = createShell();
      renderError(wrapper, new Error("Could not determine course ID from URL."));
      return;
    }

    appState.courseId = courseId;
    const uiState = await loadUiState(courseId);
    appState.collapsed = Boolean(uiState.collapsed);

    const wrapper = createShell();
    if (!wrapper && appState.collapsed) return;

    try {
      appState.rules = await loadRules(courseId);
      appState.data = await getCanvasData(courseId);
      appState.modules = analyzeModules(appState.data);
      renderTracker(wrapper, courseId, appState.data, appState.modules);
    } catch (error) {
      renderError(wrapper, error);
    }
  }

  setTimeout(init, 1000);
}

export function getStatusInfo(item) {
  switch (item.status) {
    case "passed":
      return {
        icon: "✓",
        label: "Passed",
        className: "cpt-item-complete"
      };
    case "below_passing":
      return {
        icon: "!",
        label: "Below 80%",
        className: "cpt-item-warning"
      };
    case "waiting":
      return {
        icon: "…",
        label: "Waiting for grade",
        className: "cpt-item-waiting"
      };
    case "missing":
      return {
        icon: "○",
        label: "Missing",
        className: "cpt-item-incomplete"
      };
    case "info_only":
      return {
        icon: "i",
        label: "Info only",
        className: "cpt-item-muted"
      };
    default:
      return {
        icon: "!",
        label: "Error",
        className: "cpt-item-error"
      };
  }
}

export function renderItem(item, escapeHtml) {
  const statusInfo = getStatusInfo(item);
  const gradeText =
    item.percent === null
      ? ""
      : ` <span class="cpt-grade">(${item.percent}%)</span>`;

  return `
    <li class="${statusInfo.className}">
      <span class="cpt-icon">${statusInfo.icon}</span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>${gradeText}
        <small>
          ${escapeHtml(statusInfo.label)} ·
          ${escapeHtml(item.detail || "")}
        </small>
      </span>
    </li>
  `;
}

export function renderModule(
  module,
  index,
  renderItemFn,
  escapeHtml
) {
  const itemList = module.items.length
    ? module.items
        .map((item) =>
          renderItemFn(item, escapeHtml)
        )
        .join("")
    : `
      <li class="cpt-item-muted">
        No required items found.
      </li>
    `;

  return `
    <details
      class="cpt-module-row"
      ${index === 0 ? "open" : ""}
    >
      <summary>
        <div class="cpt-module-topline">
          <span class="cpt-module-title">
            ${escapeHtml(module.name)}
          </span>

          <span class="cpt-module-percent">
            ${module.percent}%
          </span>
        </div>

        <div class="cpt-bar">
          <div
            class="cpt-bar-fill"
            style="width:${module.percent}%"
          ></div>
        </div>

        <div class="cpt-status">
          ${module.complete}/${module.total}
          required passed
        </div>
      </summary>

      <ul class="cpt-item-list">
        ${itemList}
      </ul>
    </details>
  `;
}

export function renderTracker({
  wrapper,
  courseId,
  data,
  analyzedModules,
  renderItem: renderItemFn,
  escapeHtml,
  bindEvents,
  themeLogo,
  scheduleEndDate = ""
}) {
  if (!wrapper) return;

  const allAnalyzedItems =
    analyzedModules.flatMap(
      (module) => module.items
    );

  const overallComplete =
    allAnalyzedItems.filter(
      (item) => item.complete
    ).length;

  const waitingCount =
    allAnalyzedItems.filter(
      (item) => item.status === "waiting"
    ).length;

  const belowCount =
    allAnalyzedItems.filter(
      (item) =>
        item.status === "below_passing"
    ).length;

  const missingCount =
    allAnalyzedItems.filter(
      (item) => item.status === "missing"
    ).length;

  const moduleRows = analyzedModules
    .map((module, index) =>
      renderModule(
        module,
        index,
        renderItemFn,
        escapeHtml
      )
    )
    .join("");

  wrapper.innerHTML = `
    <div class="cpt-header">
      <div class="cpt-header-title">
        <img
          class="cpt-header-logo"
          src="${chrome.runtime.getURL(themeLogo)}"
          alt=""
        >
        <div class="cpt-header-copy">
          <h2>Wayfinder</h2>
        </div>
      </div>

      <div class="cpt-header-actions">
        <button
          id="cpt-theme-button"
          type="button"
          title="Appearance"
        >
          ⚙
        </button>

        <div
          id="cpt-theme-menu"
          class="cpt-theme-menu"
          hidden
        >
          <button type="button" data-theme="ubtech">UBTech</button>
          <button type="button" data-theme="slate">Slate</button>
          <button type="button" data-theme="forest">Forest</button>
          <button type="button" data-theme="dark">Dark</button>
          <button type="button" data-theme="midnight">Midnight</button>
          <button type="button" data-theme="highcontrast">High Contrast</button>
        </div>

        <button
          id="cpt-collapse"
          type="button"
          title="Collapse panel"
        >
          –
        </button>

        <button
          id="cpt-refresh"
          type="button"
          title="Refresh progress"
        >
          ↻
        </button>
      </div>
    </div>

    <div class="cpt-student-plan-controls">
      <div class="cpt-student-plan-copy">
        <strong>Create a Success Plan</strong>
        <span>
          Enter your course end date to create a printable
          weekly schedule for your remaining work.
        </span>
      </div>

      <div class="cpt-student-plan-actions">
        <label for="cpt-student-plan-end-date">
          End Date
        </label>

        <input
          type="date"
          id="cpt-student-plan-end-date"
          class="cpt-end-date cpt-student-plan-end-date"
          data-student-id="self"
          value="${escapeHtml(scheduleEndDate)}"
        >

        <button
          type="button"
          id="cpt-student-plan-button"
        >
          Create Schedule
        </button>
      </div>
    </div>

    <div class="cpt-overall">
      <div class="cpt-summary">
        <div class="cpt-stat-card">
          <div class="cpt-stat-number">${overallComplete}</div>
          <div class="cpt-stat-label">Completed</div>
        </div>

        <div class="cpt-stat-card">
          <div class="cpt-stat-number">${waitingCount}</div>
          <div class="cpt-stat-label">Awaiting Grade</div>
        </div>

        <div class="cpt-stat-card">
          <div class="cpt-stat-number">${missingCount}</div>
          <div class="cpt-stat-label">Missing</div>
        </div>

        <div class="cpt-stat-card">
          <div class="cpt-stat-number">${belowCount}</div>
          <div class="cpt-stat-label">Below 80%</div>
        </div>
      </div>

      <div class="cpt-body">
        ${moduleRows}
      </div>

      <div class="cpt-footer">
        Course ${escapeHtml(courseId)} ·
        ${escapeHtml(
          data.user.name ||
          data.user.login_id ||
          "current user"
        )}
      </div>
    </div>
  `;

  bindEvents(wrapper);
}

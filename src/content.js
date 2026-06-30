(function () {
  "use strict";

  const EXTENSION_ID = "cpt-progress-tracker";
  const REQUIRED_KEYWORDS = ["training", "lab", "important", "assessment"];

  function getCourseIdFromUrl() {
    const match = window.location.pathname.match(/\/courses\/(\d+)\/modules/);
    return match ? match[1] : null;
  }

  function removeExistingTracker() {
    const existing = document.getElementById(EXTENSION_ID);
    if (existing) existing.remove();
  }

  function getModuleElements() {
    return Array.from(document.querySelectorAll(".context_module"))
      .filter((el) => (el.innerText || "").trim().length > 0);
  }

  function getModuleTitle(moduleEl, index) {
    const selectors = [
      ".ig-header-title",
      ".context_module_name",
      ".name",
      "h2",
      "h3"
    ];

    for (const selector of selectors) {
      const found = moduleEl.querySelector(selector);
      if (found && found.innerText.trim()) {
        return cleanText(found.innerText);
      }
    }

    return `Module ${index + 1}`;
  }

  function getModuleItems(moduleEl) {
    return Array.from(moduleEl.querySelectorAll(".context_module_item"))
      .filter((item) => (item.innerText || "").trim().length > 0);
  }

  function getItemTitle(itemEl) {
    const selectors = [
      ".ig-title",
      ".item_name",
      ".title",
      "a",
      "span"
    ];

    for (const selector of selectors) {
      const found = itemEl.querySelector(selector);
      if (found && found.innerText.trim()) {
        return cleanText(found.innerText);
      }
    }

    return cleanText(itemEl.innerText || "Untitled item");
  }


function isTextHeader(itemEl) {
  const combined = `${itemEl.innerText || ""} ${itemEl.className || ""} ${itemEl.innerHTML || ""}`.toLowerCase();

  return (
    combined.includes("text header") ||
    combined.includes("sub header") ||
    combined.includes("subheader") ||
    combined.includes("context_module_sub_header") ||
    combined.includes("module_item_type_sub_header")
  );
}


function isRequiredItem(itemEl) {
  if (isTextHeader(itemEl)) return false;

  const title = getItemTitle(itemEl).toLowerCase();
  return REQUIRED_KEYWORDS.some((keyword) => title.includes(keyword));
}
  function isItemComplete(itemEl) {
    const text = (itemEl.innerText || "").toLowerCase();
    const aria = (itemEl.getAttribute("aria-label") || "").toLowerCase();
    const className = (itemEl.className || "").toString().toLowerCase();
    const html = (itemEl.innerHTML || "").toLowerCase();
    const combined = `${text} ${aria} ${className} ${html}`;

    const incompleteSignals = [
      "missing",
      "incomplete",
      "not completed",
      "not submitted",
      "ungraded",
      "locked",
      "not available"
    ];

    const completeSignals = [
      "completed",
      "complete",
      "done",
      "submitted",
      "graded",
      "score",
      "points",
      "icon-check",
      "ig-type-icon-complete",
      "requirements_met",
      "requirement completed"
    ];

    if (incompleteSignals.some((signal) => combined.includes(signal))) {
      return false;
    }

    return completeSignals.some((signal) => combined.includes(signal));
  }

  function calculateModuleProgress(moduleEl) {
    const allItems = getModuleItems(moduleEl);
    const requiredItems = allItems.filter(isRequiredItem);

    const results = requiredItems.map((itemEl) => {
      const title = getItemTitle(itemEl);
      const complete = isItemComplete(itemEl);

      return {
        title,
        complete
      };
    });

    const total = results.length;
    const complete = results.filter((item) => item.complete).length;
    const percent = total === 0 ? 0 : Math.round((complete / total) * 100);

    return {
      total,
      complete,
      percent,
      items: results
    };
  }

  function createTracker(modules) {
    const wrapper = document.createElement("aside");
    wrapper.id = EXTENSION_ID;
    wrapper.setAttribute("aria-label", "Canvas module progress tracker");

    const courseId = getCourseIdFromUrl();

    const header = document.createElement("div");
    header.className = "cpt-header";
    header.innerHTML = `
      <div>
        <strong>Module Progress</strong>
        <span>Required: Training, Lab, Important, Assessment</span>
      </div>
      <button id="cpt-refresh" type="button" title="Refresh progress">↻</button>
    `;

    const body = document.createElement("div");
    body.className = "cpt-body";

    let courseRequiredTotal = 0;
    let courseRequiredComplete = 0;

    modules.forEach((moduleEl, index) => {
      const title = getModuleTitle(moduleEl, index);
      const progress = calculateModuleProgress(moduleEl);

      courseRequiredTotal += progress.total;
      courseRequiredComplete += progress.complete;

      const row = document.createElement("details");
      row.className = "cpt-module-row";
      if (index === 0) row.open = true;

      const statusText = progress.total === 0
        ? "No required items found"
        : `${progress.complete}/${progress.total} required complete`;

      const itemList = progress.items.length
        ? progress.items.map((item) => `
            <li class="${item.complete ? "cpt-item-complete" : "cpt-item-incomplete"}">
              <span class="cpt-icon">${item.complete ? "✓" : "○"}</span>
              <span>${escapeHtml(item.title)}</span>
            </li>
          `).join("")
        : `<li class="cpt-item-muted">No items with required keywords found in this module.</li>`;

      row.innerHTML = `
        <summary>
          <div class="cpt-module-topline">
            <span class="cpt-module-title">${escapeHtml(title)}</span>
            <span class="cpt-module-percent">${progress.percent}%</span>
          </div>
          <div class="cpt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}">
            <div class="cpt-bar-fill" style="width: ${progress.percent}%"></div>
          </div>
          <div class="cpt-status">${statusText}</div>
        </summary>
        <ul class="cpt-item-list">${itemList}</ul>
      `;

      body.appendChild(row);
    });

    const overallPercent = courseRequiredTotal === 0
      ? 0
      : Math.round((courseRequiredComplete / courseRequiredTotal) * 100);

    const overall = document.createElement("div");
    overall.className = "cpt-overall";
    overall.innerHTML = `
      <div class="cpt-module-topline">
        <span class="cpt-module-title">Overall Required Progress</span>
        <span class="cpt-module-percent">${overallPercent}%</span>
      </div>
      <div class="cpt-bar cpt-overall-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${overallPercent}">
        <div class="cpt-bar-fill" style="width: ${overallPercent}%"></div>
      </div>
      <div class="cpt-status">${courseRequiredComplete}/${courseRequiredTotal} required items complete</div>
    `;

    const footer = document.createElement("div");
    footer.className = "cpt-footer";
    footer.textContent = `Phase 1 keyword rules. Course ${courseId || ""}`;

    wrapper.appendChild(header);
    wrapper.appendChild(overall);
    wrapper.appendChild(body);
    wrapper.appendChild(footer);
    document.body.appendChild(wrapper);

    document.getElementById("cpt-refresh").addEventListener("click", init);
  }

  function cleanText(value) {
    return String(value).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function init() {
    removeExistingTracker();

    const modules = getModuleElements();

    if (!modules.length) {
      const warning = document.createElement("aside");
      warning.id = EXTENSION_ID;
      warning.className = "cpt-warning";
      warning.innerHTML = `
        <strong>Module Progress</strong>
        <p>No Canvas modules were detected on this page.</p>
        <button id="cpt-refresh" type="button">Try again</button>
      `;
      document.body.appendChild(warning);
      document.getElementById("cpt-refresh").addEventListener("click", init);
      return;
    }

    createTracker(modules);
  }

  setTimeout(init, 1200);
})();

/*
 * Wayfinder - shell.js
 *
 * Purpose:
 * Creates and manages the basic outer shell for the Wayfinder
 * Modules-page interface before the full tracker is rendered.
 *
 * This file is responsible for four primary UI states/functions:
 *
 * removeExistingUI()
 * Removes any existing Wayfinder tracker and collapsed Progress tab
 * from the page to prevent duplicate interfaces.
 *
 * createShell()
 * Creates the main Wayfinder <aside> container and displays the
 * initial "Loading Canvas progress..." interface while course data
 * is being retrieved. It also creates the Collapse and Refresh
 * controls and binds their header-button behavior.
 *
 * createCollapsedTab()
 * Creates the small "Progress" button shown when the main Wayfinder
 * panel is collapsed. Clicking the tab calls the supplied onOpen
 * handler to reopen Wayfinder.
 *
 * renderError()
 * Replaces the normal tracker content with an error message when
 * Canvas API data cannot be loaded. The error message is escaped
 * before being inserted into the page, and Collapse and Refresh
 * controls remain available.
 *
 * This file manages the Wayfinder container, loading state, collapsed
 * state, and error presentation. The completed progress interface is
 * rendered separately by panel.js.
 */


export function removeExistingUI(extensionId, tabId) {
  document.getElementById(extensionId)?.remove();
  document.getElementById(tabId)?.remove();
}

export function createShell({
  extensionId,
  tabId,
  collapsed,
  createCollapsedTab,
  bindHeaderButtons
}) {
  removeExistingUI(extensionId, tabId);

  if (collapsed) {
    createCollapsedTab();
    return null;
  }

  const wrapper = document.createElement("aside");
  wrapper.id = extensionId;
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

export function createCollapsedTab({ tabId, onOpen }) {
  const tab = document.createElement("button");
  tab.id = tabId;
  tab.type = "button";
  tab.innerHTML = `<span>Progress</span><strong>›</strong>`;
  tab.title = "Open Module Progress";
  tab.addEventListener("click", onOpen);
  document.body.appendChild(tab);
}

export function renderError({ wrapper, error, escapeHtml, bindHeaderButtons }) {
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
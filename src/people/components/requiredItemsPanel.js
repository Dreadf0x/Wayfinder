/*
 * Wayfinder - requiredItemsPanel.js
 *
 * Purpose:
 * Renders the instructor-facing Required Items selection panel used
 * by Student Radar.
 *
 * The component receives the list of selectable Canvas items and the
 * IDs that are currently selected, then builds a checkbox row for each
 * item and marks saved selections as checked.
 *
 * The panel also renders controls for Save, Reset to Defaults, Export,
 * Import, and Close.
 *
 * This file only generates the Required Items panel HTML. Saving,
 * resetting, importing, exporting, publishing the shared course
 * configuration, and refreshing Student Radar are handled by
 * peopleApp.js and related modules.
 */



function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderRequiredItemsPanel({
  assignments = [],
  selectedIds = []
} = {}) {
  const selectedSet = new Set(selectedIds.map(String));

  const rows = assignments.length
    ? assignments
        .map((assignment) => {
          const checked = selectedSet.has(String(assignment.id))
            ? "checked"
            : "";

          return `
            <label class="cpt-radar-required-item">
              <input
                type="checkbox"
                class="cpt-radar-required-checkbox"
                value="${escapeHtml(assignment.id)}"
                ${checked}
              >

              <span>${escapeHtml(assignment.name || "Untitled assignment")}</span>
            </label>
          `;
        })
        .join("")
    : `
      <p class="cpt-radar-required-empty">
        No gradable assignments found.
      </p>
    `;

  return `
    <section class="cpt-radar-required-panel" hidden>
      <div class="cpt-radar-required-header">
        <div>
          <strong>Required Items</strong>
          <span>Select which assignments count toward Student Radar progress.</span>
        </div>

        <button
          type="button"
          class="cpt-radar-required-close"
          title="Close required items"
        >
          ×
        </button>
      </div>

      <div class="cpt-radar-required-list">
        ${rows}
      </div>

      <div class="cpt-radar-required-actions">
        <button type="button" class="cpt-radar-required-save">
          Save
        </button>

        <button type="button" class="cpt-radar-required-reset">
          Reset to Defaults
        </button>

        <button type="button" class="cpt-radar-required-export">
          Export
        </button>

        <button type="button" class="cpt-radar-required-import">
          Import
        </button>
      </div>
    </section>
  `;
}
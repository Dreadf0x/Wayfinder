import { renderRadarSummaryCard } from "./components/radarSummaryCard.js";
import { renderStudentRadarTable } from "./components/studentRadarTable.js";
import { renderRequiredItemsPanel } from "./components/requiredItemsPanel.js";

export function renderStudentRadar({
  students = [],
  assignments = [],
  selectedAssignmentIds = [],
  endDates = {},
  loading = false,
  error = null
} = {}) {
  return `
    <div class="cpt-student-radar">

      <div class="cpt-overall">
        <div class="cpt-module-topline">
          <div class="cpt-radar-heading">
            <span class="cpt-module-title">Wayfinder Student Radar</span>

            <button
              type="button"
              id="cpt-radar-required-button"
              class="cpt-radar-required-button"
            >
              Required Items (${selectedAssignmentIds.length})
            </button>
          </div>
          ${renderRequiredItemsPanel({
            assignments,
            selectedIds: selectedAssignmentIds
          })}
        </div>
      </div>

      <div class="cpt-summary cpt-radar-summary">
        ${renderRadarSummaryCard("On Track", 0)}
        ${renderRadarSummaryCard("Watch List", 0)}
        ${renderRadarSummaryCard("At Risk", 0)}
        ${renderRadarSummaryCard("Inactive", 0)}
      </div>



      <div class="cpt-radar-filters">
        <label class="cpt-radar-filter">
          <input
            type="checkbox"
            id="cpt-hide-inactive"
            checked
          >
          <span>Hide inactive 100+ days</span>
        </label>

        <label class="cpt-radar-filter">
          <input
            type="checkbox"
            id="cpt-hide-complete"
            checked
          >
          <span>Hide 100% submitted and graded</span>
        </label>
      </div>

      <div class="cpt-body">
        ${renderStudentRadarTable({
            students,
            endDates,
            loading,
            error
        })}
      </div>

    </div>
  `;
}
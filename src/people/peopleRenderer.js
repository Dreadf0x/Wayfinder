/*
 * Wayfinder - peopleRenderer.js
 *
 * Purpose:
 * Composes the complete Student Radar HTML interface from the smaller
 * People-page UI components.
 *
 * renderStudentRadar() builds the Student Radar heading and toolbar,
 * including the Required Items button, selected-item count, theme menu,
 * and collapse control.
 *
 * It also renders the five summary-card categories:
 *
 * - On Track
 * - Watch List
 * - At Risk
 * - Inactive
 * - End Date Alert
 *
 * The renderer includes instructor filters for hiding students inactive
 * for 100+ days and students who are fully submitted and graded.
 *
 * It delegates the Required Items panel to requiredItemsPanel.js,
 * summary cards to radarSummaryCard.js, and the main student table to
 * studentRadarTable.js.
 *
 * This file generates markup only; API requests, storage, calculations,
 * and event binding are handled elsewhere.
 */


import { renderRadarSummaryCard } from "./components/radarSummaryCard.js";
import { renderStudentRadarTable } from "./components/studentRadarTable.js";
import { renderRequiredItemsPanel } from "./components/requiredItemsPanel.js";

function getEmptySummaryGroups() {
  return {
    onTrack: [],
    watchList: [],
    atRisk: [],
    inactive: [],
    endDateAlert: []
  };
}

export function renderStudentRadar({
  students = [],
  assignments = [],
  selectedAssignmentIds = [],
  endDates = {},
  summaryGroups = getEmptySummaryGroups(),
  loading = false,
  error = null
} = {}) {
  return `
    <div class="cpt-student-radar">

      <div class="cpt-overall">
        <div class="cpt-module-topline">
          <div class="cpt-radar-heading">
            <span class="cpt-module-title">
              Wayfinder Student Radar
            </span>

            <div class="cpt-radar-heading-actions">
              <button
                type="button"
                id="cpt-radar-required-button"
                class="cpt-radar-required-button"
                title="Choose required items"
              >
                <span
                  class="cpt-radar-required-icon"
                  aria-hidden="true"
                >
                  ✓
                </span>

                <span class="cpt-radar-required-label">
                  Required Items
                </span>

                <span class="cpt-radar-required-count">
                  ${selectedAssignmentIds.length}
                </span>
              </button>

              <button
                id="cpt-theme-button"
                type="button"
                title="Appearance"
                aria-label="Choose Wayfinder theme"
                aria-expanded="false"
              >
                ⚙
              </button>

              <div
                id="cpt-theme-menu"
                class="cpt-theme-menu"
                hidden
              >
                <button type="button" data-theme="ubtech">
                  UBTech
                </button>

                <button type="button" data-theme="slate">
                  Slate
                </button>

                <button type="button" data-theme="forest">
                  Forest
                </button>

                <button type="button" data-theme="dark">
                  Dark
                </button>

                <button type="button" data-theme="midnight">
                  Midnight
                </button>

                <button type="button" data-theme="highcontrast">
                  High Contrast
                </button>
              </div>

              <button
                type="button"
                id="cpt-radar-collapse"
                class="cpt-radar-collapse-button"
                title="Collapse Student Radar"
                aria-label="Collapse Student Radar"
              >
                –
              </button>
            </div>
          </div>

          ${renderRequiredItemsPanel({
            assignments,
            selectedIds: selectedAssignmentIds
          })}
        </div>
      </div>

      <div class="cpt-summary cpt-radar-summary">
        ${renderRadarSummaryCard({
          label: "On Track",
          students: summaryGroups.onTrack,
          emptyMessage:
            "No unfinished students were active within the last 5 days."
        })}

        ${renderRadarSummaryCard({
          label: "Watch List",
          students: summaryGroups.watchList,
          emptyMessage:
            "No unfinished students have been inactive for 5–9 days."
        })}

        ${renderRadarSummaryCard({
          label: "At Risk",
          students: summaryGroups.atRisk,
          emptyMessage:
            "No unfinished students have been inactive for 10–99 days."
        })}

        ${renderRadarSummaryCard({
          label: "Inactive",
          students: summaryGroups.inactive,
          emptyMessage:
            "No unfinished students have been inactive for 100+ days."
        })}

        ${renderRadarSummaryCard({
          label: "End Date Alert",
          students: summaryGroups.endDateAlert,
          emptyMessage:
            "No unfinished students are within 10 days of their end date."
        })}
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
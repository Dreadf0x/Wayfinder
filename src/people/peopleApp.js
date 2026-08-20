import {
  getCourseStudents,
  getRadarAssignments,
  getRadarSubmissions
} from "./peopleApi.js";

import { renderStudentRadar } from "./peopleRenderer.js";



import {
  loadUiState,
  saveUiState
} from "../storage/rules.js";


import { applyTheme, getTheme } from "../themes/themes.js";

import { initializeRadarTooltips } from "./radarTooltips.js";

import { bindStudentScheduleButtons } from "./studentSchedule.js";

import {
  loadEndDates,
  loadRequiredItemIds,
  loadRadarUiState,
  saveEndDate,
  saveRequiredItemIds,
  saveRadarUiState
} from "./peopleStorage.js";

import {
  createCourseConfig,
  downloadCourseConfig
} from "../shared/courseConfig.js";


import {
  publishCourseConfigToCanvas
} from "../shared/canvasCourseConfig.js";

function loadRadarStyles() {
  if (document.getElementById("wayfinder-radar-css")) {
    return;
  }

  const link = document.createElement("link");
  link.id = "wayfinder-radar-css";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("people/radar.css");

  document.head.appendChild(link);
}

function getCourseIdFromUrl() {
  const match = window.location.pathname.match(
    /\/courses\/(\d+)\/users/
  );

  return match ? match[1] : null;
}

function getDefaultRequiredItemIds(assignments) {
  return assignments
    .filter((assignment) => {
      const name = String(
        assignment.name || ""
      ).toLowerCase();

      return (
        name.includes("training") ||
        name.includes("assessment")
      );
    })
    .map((assignment) => String(assignment.id));
}

function getStudentName(student) {
  return (
    student.name ||
    student.sortable_name ||
    "Unknown Student"
  );
}

function getDaysSinceLastActivity(student) {
  const enrollment = student.enrollments?.[0];
  const lastActivity = enrollment?.last_activity_at;

  if (!lastActivity) {
    return Number.POSITIVE_INFINITY;
  }

  const lastActivityTime = new Date(lastActivity).getTime();

  if (Number.isNaN(lastActivityTime)) {
    return Number.POSITIVE_INFINITY;
  }

  const differenceMs = Date.now() - lastActivityTime;

  return Math.max(
    0,
    Math.floor(
      differenceMs / (1000 * 60 * 60 * 24)
    )
  );
}

function formatActivityDetail(daysSinceActivity) {
  if (!Number.isFinite(daysSinceActivity)) {
    return "No activity recorded";
  }

  if (daysSinceActivity === 0) {
    return "Active today";
  }

  if (daysSinceActivity === 1) {
    return "Last activity 1 day ago";
  }

  return `Last activity ${daysSinceActivity} days ago`;
}

/*
 * Converts YYYY-MM-DD into a local date.
 *
 * Using new Date("2026-07-10") directly can interpret the value
 * as UTC and shift the date backward in some time zones.
 */
function parseLocalDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const match = String(dateValue).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const date = new Date(year, monthIndex, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getStartOfToday() {
  const today = new Date();

  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
}

function getDaysUntilEndDate(endDateValue) {
  const endDate = parseLocalDate(endDateValue);

  if (!endDate) {
    return null;
  }

  const today = getStartOfToday();
  const differenceMs =
    endDate.getTime() - today.getTime();

  return Math.round(
    differenceMs / (1000 * 60 * 60 * 24)
  );
}

function formatEndDateDetail(daysUntilEndDate) {
  if (daysUntilEndDate < 0) {
    const overdueDays = Math.abs(daysUntilEndDate);

    return overdueDays === 1
      ? "End date overdue by 1 day"
      : `End date overdue by ${overdueDays} days`;
  }

  if (daysUntilEndDate === 0) {
    return "End date is today";
  }

  if (daysUntilEndDate === 1) {
    return "End date is tomorrow";
  }

  return `End date is in ${daysUntilEndDate} days`;
}

function buildRadarSummaryGroups(students, endDates) {
  const groups = {
    onTrack: [],
    watchList: [],
    atRisk: [],
    inactive: [],
    endDateAlert: []
  };

  for (const student of students) {
    const isComplete =
      student.submittedPercent === 100 &&
      student.gradedPercent === 100;

    /*
     * Completed students do not count toward any summary card,
     * including End Date Alert.
     */
    if (isComplete) {
      continue;
    }

    const name = getStudentName(student);
    const daysSinceActivity =
      getDaysSinceLastActivity(student);

    const activityEntry = {
      id: String(student.id),
      name,
      detail: formatActivityDetail(daysSinceActivity)
    };

    if (
      !Number.isFinite(daysSinceActivity) ||
      daysSinceActivity >= 100
    ) {
      groups.inactive.push(activityEntry);
    } else if (daysSinceActivity >= 10) {
      groups.atRisk.push(activityEntry);
    } else if (daysSinceActivity >= 5) {
      groups.watchList.push(activityEntry);
    } else {
      groups.onTrack.push(activityEntry);
    }

    const endDateValue =
      endDates[String(student.id)];

    const daysUntilEndDate =
      getDaysUntilEndDate(endDateValue);

    /*
     * Missing dates return null and do not trigger.
     *
     * Ten or fewer days includes:
     * - upcoming dates within 10 days
     * - today
     * - overdue dates
     */
    if (
      daysUntilEndDate !== null &&
      daysUntilEndDate <= 10
    ) {
      groups.endDateAlert.push({
        id: String(student.id),
        name,
        detail: formatEndDateDetail(
          daysUntilEndDate
        )
      });
    }
  }

  return groups;
}

function bindStudentFilters(panel) {
  const hideInactiveCheckbox = panel.querySelector(
    "#cpt-hide-inactive"
  );

  const hideCompleteCheckbox = panel.querySelector(
    "#cpt-hide-complete"
  );

  function applyFilters() {
    const hideInactive =
      hideInactiveCheckbox?.checked ?? true;

    const hideComplete =
      hideCompleteCheckbox?.checked ?? true;

    const studentRows = panel.querySelectorAll(
      "[data-radar-student-row]"
    );

    for (const row of studentRows) {
      const inactiveDays = Number(
        row.dataset.inactiveDays
      );

      const submittedPercent = Number(
        row.dataset.submittedPercent
      );

      const gradedPercent = Number(
        row.dataset.gradedPercent
      );

      const isInactive =
        row.dataset.inactiveDays === "Infinity" ||
        (
          Number.isFinite(inactiveDays) &&
          inactiveDays >= 100
        );

      const isComplete =
        submittedPercent === 100 &&
        gradedPercent === 100;

      row.hidden =
        (hideInactive && isInactive) ||
        (hideComplete && isComplete);
    }
  }

  hideInactiveCheckbox?.addEventListener(
    "change",
    applyFilters
  );

  hideCompleteCheckbox?.addEventListener(
    "change",
    applyFilters
  );

  applyFilters();
}
function bindEndDateInputs({
  panel,
  courseId
}) {
  const endDateInputs = panel.querySelectorAll(
    ".cpt-end-date[data-student-id]"
  );

  for (const input of endDateInputs) {
    const originalValue = input.value;

    /*
     * Save only after the instructor leaves the date field.
     * Saving on "change" can interrupt typing the year because
     * Student Radar rerenders immediately after the save.
     */
    input.addEventListener("blur", async () => {
      const studentId = input.dataset.studentId;
      const endDate = input.value;

      if (!studentId) {
        return;
      }

      /*
       * Do nothing when the value was not changed.
       */
      if (endDate === originalValue) {
        return;
      }

      /*
       * A date input should contain either a complete
       * YYYY-MM-DD value or an empty string.
       */
      const isValidDate =
        endDate === "" ||
        /^\d{4}-\d{2}-\d{2}$/.test(endDate);

      if (!isValidDate) {
        return;
      }

      input.disabled = true;

      try {
        await saveEndDate(
          courseId,
          studentId,
          endDate
        );

        /*
         * Reload Student Radar after the field loses focus
         * so the End Date Alert summary card recalculates.
         */
        panel.remove();
        await initializePeopleView();
      } catch (error) {
        console.error(
          "Wayfinder could not save the student end date:",
          error
        );

        input.disabled = false;
      }
    });
  }
}

function bindRequiredItemsPanel({
  panel,
  courseId,
  assignments
}) {
  const openButton = panel.querySelector(
    "#cpt-radar-required-button"
  );

  const requiredPanel = panel.querySelector(
    ".cpt-radar-required-panel"
  );

  const closeButton = panel.querySelector(
    ".cpt-radar-required-close"
  );

  const saveButton = panel.querySelector(
    ".cpt-radar-required-save"
  );

  const resetButton = panel.querySelector(
    ".cpt-radar-required-reset"
  );

  if (!openButton || !requiredPanel) {
    return;
  }

  async function saveSelection() {
    const checkedIds = Array.from(
      panel.querySelectorAll(
        ".cpt-radar-required-checkbox:checked"
      )
    ).map(
      (checkbox) =>
        String(checkbox.value)
    );

    await saveRequiredItemIds(
      courseId,
      checkedIds
    );

    const checkedIdSet =
      new Set(checkedIds);

    const selectedAssignments =
      assignments.filter((assignment) => {
        return (
          checkedIdSet.has(
            String(assignment.id)
          ) ||
          (
            assignment.assignmentId &&
            checkedIdSet.has(
              String(assignment.assignmentId)
            )
          )
        );
  });

    const selectedCanvasAssignmentIds =
      selectedAssignments
        .map(
          (assignment) =>
            assignment.assignmentId
        )
        .filter(Boolean);

    const radarSubmissions =
      await getRadarSubmissions(
        courseId,
        selectedCanvasAssignmentIds
      );

    const uiState =
      await loadUiState(courseId);

    const config =
      createCourseConfig({
        courseId,

        requiredItems:
          selectedAssignments,

        settings: {
          passingPercent: 80,

          theme:
            uiState.theme ||
            "ubtech"
        }
      });

    /*
 * Keep the local download during this testing phase.
 */
downloadCourseConfig(config);

    /*
    * Publish the same configuration into the current
    * Canvas course's Files area.
    */
    await publishCourseConfigToCanvas({
      courseId,
      config
    });

    console.info(
      "Wayfinder course configuration generated and uploaded:",
      config
    );

    panel.remove();

    await initializePeopleView();
  }

  openButton.addEventListener(
    "click",
    async () => {
      if (requiredPanel.hidden) {
        requiredPanel.hidden = false;
        return;
      }

      openButton.disabled = true;

      try {
        await saveSelection();
      } catch (error) {
        console.error(
          "Wayfinder could not save required items:",
          error
        );

        openButton.disabled = false;
      }
    }
  );

  closeButton?.addEventListener(
    "click",
    () => {
      requiredPanel.hidden = true;
    }
  );

  saveButton?.addEventListener(
    "click",
    async () => {
      saveButton.disabled = true;

      try {
        await saveSelection();
      } catch (error) {
        console.error(
          "Wayfinder could not save required items:",
          error
        );

        saveButton.disabled = false;
      }
    }
  );

  resetButton?.addEventListener(
    "click",
    async () => {
      resetButton.disabled = true;

      try {
        const defaultIds =
          getDefaultRequiredItemIds(
            assignments
          );

        await saveRequiredItemIds(
          courseId,
          defaultIds
        );

        const defaultIdSet =
          new Set(
            defaultIds.map(String)
          );

        const defaultAssignments =
          assignments.filter(
            (assignment) =>
              defaultIdSet.has(
                String(assignment.id)
              )
          );

        const uiState =
          await loadUiState(courseId);

        const config =
          createCourseConfig({
            courseId,

            requiredItems:
              defaultAssignments,

            settings: {
              passingPercent: 80,

              theme:
                uiState.theme ||
                "ubtech"
            }
          });

            /*
      * Keep the local download during this testing phase.
      */
      downloadCourseConfig(config);

      /*
      * Upload the reset/default configuration to Canvas.
      */
      await publishCourseConfigToCanvas({
        courseId,
        config
      });

      console.info(
        "Wayfinder default course configuration generated and uploaded:",
        config
      );

        panel.remove();

        await initializePeopleView();
      } catch (error) {
        console.error(
          "Wayfinder could not reset required items:",
          error
        );

        resetButton.disabled = false;
      }
    }
  );
}

function removeRadarUi() {
  document
    .querySelector("#cpt-progress-tracker")
    ?.remove();

  document
    .querySelector("#cpt-radar-collapsed-tab")
    ?.remove();
}

function createRadarCollapsedTab(courseId) {
  document
    .querySelector("#cpt-radar-collapsed-tab")
    ?.remove();

  const tab = document.createElement("button");

  tab.id = "cpt-radar-collapsed-tab";
  tab.className = "cpt-radar-collapsed-tab";
  tab.type = "button";

  tab.title = "Open Wayfinder Student Radar";
  tab.setAttribute(
    "aria-label",
    "Open Wayfinder Student Radar"
  );

  tab.innerHTML = `
    <span class="cpt-radar-collapsed-tab-text">
      Student Radar
    </span>

    <span
      class="cpt-radar-collapsed-tab-arrow"
      aria-hidden="true"
    >
      ‹
    </span>
  `;

  tab.addEventListener("click", async () => {
    tab.disabled = true;

    try {
      await saveRadarUiState(courseId, {
        collapsed: false
      });

      tab.remove();
      await initializePeopleView();
    } catch (error) {
      console.error(
        "Wayfinder could not reopen Student Radar:",
        error
      );

      tab.disabled = false;
    }
  });

  document.body.appendChild(tab);
}

function bindRadarThemeMenu({
  panel,
  courseId
}) {
  const themeButton = panel.querySelector(
    "#cpt-theme-button"
  );

  const themeMenu = panel.querySelector(
    "#cpt-theme-menu"
  );

  if (!themeButton || !themeMenu) {
    return;
  }

  themeButton.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      const willOpen = themeMenu.hidden;

      themeMenu.hidden = !willOpen;

      themeButton.setAttribute(
        "aria-expanded",
        String(willOpen)
      );
    }
  );

  themeMenu
    .querySelectorAll("[data-theme]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const themeId = getTheme(
            button.dataset.theme
          ).id;

          applyTheme(themeId);

          themeMenu.hidden = true;

          themeButton.setAttribute(
            "aria-expanded",
            "false"
          );

          /*
           * Preserve the main Wayfinder UI settings while
           * changing only the shared course theme.
           */
          const currentUiState =
            await loadUiState(courseId);

          await saveUiState(courseId, {
            ...currentUiState,
            theme: themeId
          });
        }
      );
    });

  document.addEventListener(
    "click",
    (event) => {
      if (
        themeMenu.hidden ||
        themeMenu.contains(event.target) ||
        themeButton.contains(event.target)
      ) {
        return;
      }

      themeMenu.hidden = true;

      themeButton.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  );
}

function bindRadarCollapseButton({
  panel,
  courseId
}) {
  const collapseButton = panel.querySelector(
    "#cpt-radar-collapse"
  );

  collapseButton?.addEventListener(
    "click",
    async () => {
      collapseButton.disabled = true;

      try {
        await saveRadarUiState(courseId, {
          collapsed: true
        });

        panel.remove();
        createRadarCollapsedTab(courseId);
      } catch (error) {
        console.error(
          "Wayfinder could not collapse Student Radar:",
          error
        );

        collapseButton.disabled = false;
      }
    }
  );
}

export async function initializePeopleView() {
  loadRadarStyles();

  const courseId = getCourseIdFromUrl();

  if (!courseId) {
    return;
  }

  /*
  * Use the same course theme selected in the main
  * Wayfinder module-progress panel.
  */
  const wayfinderUiState =
    await loadUiState(courseId);

  const activeTheme =
    getTheme(wayfinderUiState.theme);

  applyTheme(activeTheme.id);

  removeRadarUi();

  const radarUiState =
    await loadRadarUiState(courseId);

  if (radarUiState.collapsed) {
    createRadarCollapsedTab(courseId);
    return;
  }


  const panel = document.createElement("div");
  panel.id = "cpt-progress-tracker";

  panel.innerHTML = renderStudentRadar({
    students: [],
    assignments: [],
    selectedAssignmentIds: [],
    endDates: {},
    loading: true,
    error: null
  });

  document.body.appendChild(panel);

  try {
    const students =
      await getCourseStudents(courseId);

    const assignments =
      await getRadarAssignments(courseId);

    const endDates =
      await loadEndDates(courseId);

    const storedRequiredItemIds =
      await loadRequiredItemIds(courseId);

    const defaultRequiredItemIds =
      getDefaultRequiredItemIds(assignments);

    const selectedAssignmentIds =
      storedRequiredItemIds === null
        ? defaultRequiredItemIds
        : storedRequiredItemIds;

    const selectedIdSet = new Set(
      selectedAssignmentIds.map(String)
    );

    const selectedAssignments =
      assignments.filter((assignment) =>
        selectedIdSet.has(String(assignment.id))
      );

    /*
    * The People picker uses module-item IDs such as:
    * module:33016661
    *
    * Canvas submission APIs require the real numeric
    * assignment IDs instead.
    */
    const selectedCanvasAssignmentIds =
      selectedAssignments
        .map((assignment) =>
          assignment.assignmentId
        )
        .filter(Boolean);

    const radarSubmissions =
      await getRadarSubmissions(
        courseId,
        selectedCanvasAssignmentIds
      );

    const submissionsByStudentId = new Map();

    for (const submission of radarSubmissions) {
      const studentId = String(
        submission.user_id
      );

      if (
        !submissionsByStudentId.has(studentId)
      ) {
        submissionsByStudentId.set(
          studentId,
          []
        );
      }

      submissionsByStudentId
        .get(studentId)
        .push(submission);
    }

    const totalRequiredItems =
      selectedAssignments.length;

    const studentsWithProgress = students.map(
      (student) => {
        const studentSubmissions =
          submissionsByStudentId.get(
            String(student.id)
          ) || [];

        /*
         * Compare each required assignment against the
         * submissions returned for this student.
         */
        const submissionsByAssignmentId =
          new Map();

        for (
          const submission of studentSubmissions
        ) {
          submissionsByAssignmentId.set(
            String(submission.assignment_id),
            submission
          );
        }

        const missingSubmissionItems = [];
        const ungradedItems = [];

        for (
          const assignment of selectedAssignments
        ) {
          const submission =
            assignment.assignmentId
              ? submissionsByAssignmentId.get(
                  String(assignment.assignmentId)
                )
              : null;

          const hasBeenSubmitted = Boolean(
            submission?.submitted_at
          );

          const hasBeenGraded =
            submission?.workflow_state ===
              "graded" &&
            submission?.grade !== null &&
            submission?.grade !== undefined;

          if (!hasBeenSubmitted) {
            missingSubmissionItems.push({
              id: assignment.id,
              name: assignment.name,
              moduleName:
                assignment.moduleName,
              status: "Not submitted"
            });
          }

          if (!hasBeenGraded) {
            ungradedItems.push({
              id: assignment.id,
              name: assignment.name,
              moduleName:
                assignment.moduleName,
              status: hasBeenSubmitted
                ? "Submitted, awaiting grade"
                : "Not submitted"
            });
          }
        }

        const submittedCount =
          totalRequiredItems -
          missingSubmissionItems.length;

        const gradedCount =
          totalRequiredItems -
          ungradedItems.length;

        return {
          ...student,

          submittedPercent:
            totalRequiredItems === 0
              ? null
              : Math.round(
                  (
                    submittedCount /
                    totalRequiredItems
                  ) * 100
                ),

          gradedPercent:
            totalRequiredItems === 0
              ? null
              : Math.round(
                  (
                    gradedCount /
                    totalRequiredItems
                  ) * 100
                ),

          missingSubmissionItems,
          ungradedItems
        };
      }
    );

    /*
     * STEP 6:
     * Build the five summary groups after every student has
     * received submittedPercent and gradedPercent.
     */
    const summaryGroups =
      buildRadarSummaryGroups(
        studentsWithProgress,
        endDates
      );

    /*
     * STEP 7:
     * Pass summaryGroups into the renderer.
     */
    panel.innerHTML = renderStudentRadar({
      students: studentsWithProgress,
      assignments,
      selectedAssignmentIds,
      endDates,
      summaryGroups,
      loading: false,
      error: null
    });

    bindRequiredItemsPanel({
      panel,
      courseId,
      assignments
    });

    bindStudentFilters(panel);

    bindEndDateInputs({
      panel,
      courseId
    });

    bindRadarCollapseButton({
      panel,
      courseId
    });

    
    bindRadarThemeMenu({
      panel,
      courseId
    });

    bindStudentScheduleButtons({
      panel,
      students: studentsWithProgress,
      endDates,
      assignments: selectedAssignments
    });

    initializeRadarTooltips(panel);

   } catch (error) {
    console.error(
      "Wayfinder Student Radar error:",
      error
    );

    panel.innerHTML = renderStudentRadar({
      students: [],
      assignments: [],
      selectedAssignmentIds: [],
      endDates: {},
      loading: false,
      error: error.message
    });
  }
}
import {
  getCourseStudents,
  getRadarAssignments,
  getRadarSubmissions
} from "./peopleApi.js";

import { renderStudentRadar } from "./peopleRenderer.js";

import {
  loadEndDates,
  loadRequiredItemIds,
  saveRequiredItemIds
} from "./peopleStorage.js";

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
      const name = String(assignment.name || "").toLowerCase();

      return (
        name.includes("training") ||
        name.includes("assessment")
      );
    })
    .map((assignment) => String(assignment.id));
}

function bindStudentFilters(panel) {
  const hideInactiveCheckbox = panel.querySelector(
    "#cpt-hide-inactive"
  );

  const hideCompleteCheckbox = panel.querySelector(
    "#cpt-hide-complete"
  );

  function applyFilters() {
    const hideInactive = hideInactiveCheckbox?.checked ?? true;
    const hideComplete = hideCompleteCheckbox?.checked ?? true;

    const studentRows = panel.querySelectorAll(
      "[data-radar-student-row]"
    );

    for (const row of studentRows) {
      const inactiveDays = Number(row.dataset.inactiveDays);
      const submittedPercent = Number(
        row.dataset.submittedPercent
      );
      const gradedPercent = Number(
        row.dataset.gradedPercent
      );

      const isInactive =
        row.dataset.inactiveDays === "Infinity" ||
        (Number.isFinite(inactiveDays) && inactiveDays >= 100);

      const isComplete =
        submittedPercent === 100 &&
        gradedPercent === 100;

      row.hidden =
        (hideInactive && isInactive) ||
        (hideComplete && isComplete);
    }
  }

  hideInactiveCheckbox?.addEventListener("change", applyFilters);
  hideCompleteCheckbox?.addEventListener("change", applyFilters);

  applyFilters();
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

  openButton.addEventListener("click", () => {
    requiredPanel.hidden = false;
  });

  closeButton?.addEventListener("click", () => {
    requiredPanel.hidden = true;
  });

  saveButton?.addEventListener("click", async () => {
    const checkedIds = Array.from(
      panel.querySelectorAll(
        ".cpt-radar-required-checkbox:checked"
      )
    ).map((checkbox) => String(checkbox.value));

    await saveRequiredItemIds(courseId, checkedIds);

    panel.remove();
    await initializePeopleView();
  });

  resetButton?.addEventListener("click", async () => {
    const defaultIds = getDefaultRequiredItemIds(assignments);

    await saveRequiredItemIds(courseId, defaultIds);

    panel.remove();
    await initializePeopleView();
  });
}

export async function initializePeopleView() {
  loadRadarStyles();

  const courseId = getCourseIdFromUrl();

  if (!courseId) {
    return;
  }

  document.querySelector("#cpt-progress-tracker")?.remove();

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
    const students = await getCourseStudents(courseId);
    const assignments = await getRadarAssignments(courseId);
    const endDates = await loadEndDates(courseId);

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

    const selectedAssignments = assignments.filter(
      (assignment) =>
        selectedIdSet.has(String(assignment.id))
    );

    const radarSubmissions = await getRadarSubmissions(
      courseId,
      selectedAssignmentIds
    );

    const submissionsByStudentId = new Map();

    for (const submission of radarSubmissions) {
      const studentId = String(submission.user_id);

      if (!submissionsByStudentId.has(studentId)) {
        submissionsByStudentId.set(studentId, []);
      }

      submissionsByStudentId
        .get(studentId)
        .push(submission);
    }

    const totalRequiredItems = selectedAssignments.length;

    const studentsWithProgress = students.map((student) => {
      const studentSubmissions =
        submissionsByStudentId.get(String(student.id)) || [];

      const submittedCount = studentSubmissions.filter(
        (submission) => Boolean(submission.submitted_at)
      ).length;

      const gradedCount = studentSubmissions.filter(
        (submission) =>
          submission.workflow_state === "graded" &&
          submission.grade !== null &&
          submission.grade !== undefined
      ).length;

      return {
        ...student,

        submittedPercent:
          totalRequiredItems === 0
            ? null
            : Math.round(
                (submittedCount / totalRequiredItems) * 100
              ),

        gradedPercent:
          totalRequiredItems === 0
            ? null
            : Math.round(
                (gradedCount / totalRequiredItems) * 100
              )
      };
    });

    panel.innerHTML = renderStudentRadar({
      students: studentsWithProgress,
      assignments,
      selectedAssignmentIds,
      endDates,
      loading: false,
      error: null
    });

    bindRequiredItemsPanel({
      panel,
      courseId,
      assignments
    });

    bindStudentFilters(panel);

  } catch (error) {
    console.error("Wayfinder Student Radar error:", error);

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
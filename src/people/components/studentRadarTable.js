import { renderRadarProgressBar } from "./radarProgressBar.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    Math.floor(differenceMs / (1000 * 60 * 60 * 24))
  );
}

function formatLastActivity(student) {
  const diffDays = getDaysSinceLastActivity(student);

  if (!Number.isFinite(diffDays)) {
    return "No activity";
  }

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}

function getActivityStatus(student) {
  const diffDays = getDaysSinceLastActivity(student);

  if (!Number.isFinite(diffDays) || diffDays >= 8) {
    return {
      icon: "⛔",
      className: "cpt-activity-inactive"
    };
  }

  if (diffDays <= 3) {
    return {
      icon: "✓",
      className: "cpt-activity-recent"
    };
  }

  return {
    icon: "⚠",
    className: "cpt-activity-watch"
  };
}

export function renderStudentRadarTable({
  students = [],
  endDates = {},
  loading = false,
  error = null
} = {}) {
  let rows = "";

  if (loading) {
    rows = `<tr><td colspan="5">Loading students...</td></tr>`;
  } else if (error) {
    rows = `
      <tr>
        <td colspan="5">
          Could not load students: ${escapeHtml(error)}
        </td>
      </tr>
    `;
  } else if (!students.length) {
    rows = `<tr><td colspan="5">No students found.</td></tr>`;
  } else {
    rows = students
      .map((student) => {
        const activity = getActivityStatus(student);
        const inactiveDays = getDaysSinceLastActivity(student);

        return `
          <tr
            data-radar-student-row
            data-inactive-days="${inactiveDays}"
            data-submitted-percent="${student.submittedPercent ?? ""}"
            data-graded-percent="${student.gradedPercent ?? ""}"
          >
            <td>
              ${escapeHtml(
                student.name ||
                student.sortable_name ||
                "Unknown Student"
              )}
            </td>

            <td>
              ${renderRadarProgressBar(student.submittedPercent)}
            </td>

            <td>
              ${renderRadarProgressBar(student.gradedPercent)}
            </td>

            <td>
              <span class="cpt-activity-badge ${activity.className}">
                <span class="cpt-activity-icon">
                  ${activity.icon}
                </span>
                ${escapeHtml(formatLastActivity(student))}
              </span>
            </td>

            <td>
              <input
                type="date"
                class="cpt-end-date"
                data-student-id="${escapeHtml(student.id)}"
                value="${escapeHtml(
                  endDates[String(student.id)] || ""
                )}"
              >
            </td>
          </tr>
        `;
      })
      .join("");
  }

  return `
    <div class="cpt-module-row">
      <div class="cpt-module-topline">
        <span class="cpt-module-title">Students</span>
      </div>

      <div class="cpt-radar-table-wrap">
        <table class="cpt-radar-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Submitted</th>
              <th>Graded</th>
              <th>Last Activity</th>
              <th>End Date</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
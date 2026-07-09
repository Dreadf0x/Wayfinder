import { renderRadarProgressBar } from "./radarProgressBar.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLastActivity(student) {
  const enrollment = student.enrollments?.[0];
  const lastActivity = enrollment?.last_activity_at;

  if (!lastActivity) return "No activity";

  const lastDate = new Date(lastActivity);
  const now = new Date();

  const diffMs = now - lastDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}


function getActivityStatus(student) {
  const enrollment = student.enrollments?.[0];
  const lastActivity = enrollment?.last_activity_at;

  if (!lastActivity) {
    return {
      icon: "⛔",
      className: "cpt-activity-inactive"
    };
  }

  const diffDays = Math.floor(
    (new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 3) {
    return {
      icon: "✓",
      className: "cpt-activity-recent"
    };
  }

  if (diffDays <= 7) {
    return {
      icon: "⚠",
      className: "cpt-activity-watch"
    };
  }

  return {
    icon: "⛔",
    className: "cpt-activity-inactive"
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
    rows = `<tr><td colspan="5">Could not load students: ${escapeHtml(error)}</td></tr>`;
  } else if (!students.length) {
    rows = `<tr><td colspan="5">No students found.</td></tr>`;
  } else {
    rows = students
      .map((student) => {
        return `
          <tr>
            <td>${escapeHtml(student.name || student.sortable_name || "Unknown Student")}</td>
            <td>${renderRadarProgressBar(student.submittedPercent)}</td>
            <td>${renderRadarProgressBar(student.gradedPercent)}</td>
            <td>
              ${(() => {
                const activity = getActivityStatus(student);

                return `
                  <span class="cpt-activity-badge ${activity.className}">
                    <span class="cpt-activity-icon">${activity.icon}</span>
                    ${escapeHtml(formatLastActivity(student))}
                  </span>
                `;
              })()}
            </td>
            <td>
              <input
                type="date"
                class="cpt-end-date"
                data-student-id="${student.id}"
                value="${escapeHtml(endDates[String(student.id)] || "")}"
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
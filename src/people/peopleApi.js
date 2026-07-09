export async function canvasFetchJson(path) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status}`);
  }

  return response.json();
}

export async function getCourseStudents(courseId) {
  return canvasFetchJson(
    `/api/v1/courses/${courseId}/users?enrollment_type[]=student&include[]=enrollments&per_page=100`
  );
}

export async function getRadarAssignments(courseId) {
  const assignments = await canvasFetchJson(
    `/api/v1/courses/${courseId}/assignments?per_page=100`
  );

  return assignments.filter((assignment) => {
    const name = String(assignment.name || "").toLowerCase();

    const matchesRadarKeyword =
      name.includes("training") || name.includes("assessment");

    const isGradable =
      assignment.id &&
      assignment.points_possible !== null &&
      assignment.points_possible !== undefined &&
      assignment.workflow_state !== "deleted";

    return matchesRadarKeyword && isGradable;
  });
}

export async function getSubmissionsForAssignment(courseId, assignmentId) {
  return canvasFetchJson(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?student_ids[]=all&per_page=100`
  );
}
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

export async function canvasFetchAll(path) {
  const allResults = [];
  let nextUrl = path;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status}`);
    }

    const pageResults = await response.json();

    if (Array.isArray(pageResults)) {
      allResults.push(...pageResults);
    }

    const linkHeader = response.headers.get("Link");
    nextUrl = getNextPageUrl(linkHeader);
  }

  return allResults;
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  const links = linkHeader.split(",");

  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);

    if (match && match[2] === "next") {
      return match[1];
    }
  }

  return null;
}



export async function getCourseStudents(courseId) {
  return canvasFetchJson(
    `/api/v1/courses/${courseId}/users?enrollment_type[]=student&include[]=enrollments&per_page=100`
  );
}

export async function getRadarAssignments(courseId) {
  const modules = await canvasFetchJson(
    `/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`
  );

  const assignmentsById = new Map();

  for (const module of modules) {
    // Only use published modules.
    if (module.published === false) continue;

    for (const item of module.items || []) {
      // Assignment covers normal assignments and most graded quizzes
      // represented through Canvas's assignment system.
      if (item.type !== "Assignment") continue;

      const assignmentId = item.content_id;

      if (!assignmentId) continue;

      assignmentsById.set(String(assignmentId), {
        id: assignmentId,
        name: item.title || "Untitled assignment",
        moduleId: module.id,
        moduleName: module.name
      });
    }
  }

  return Array.from(assignmentsById.values());
}

export async function getSubmissionsForAssignment(courseId, assignmentId) {
  return canvasFetchJson(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?student_ids[]=all&per_page=100`
  );
}

export async function getRadarSubmissions(courseId, assignmentIds) {
  if (!assignmentIds.length) {
    return [];
  }

  const params = new URLSearchParams();

  params.append("student_ids[]", "all");
  params.append("per_page", "100");

  for (const assignmentId of assignmentIds) {
    params.append("assignment_ids[]", String(assignmentId));
  }

  return canvasFetchAll(
    `/api/v1/courses/${courseId}/students/submissions?${params.toString()}`
  );
}
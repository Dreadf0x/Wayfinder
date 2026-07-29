function createCanvasApiError({
  status,
  path,
  detail = ""
}) {
  const error = new Error(
    `Canvas API error ${status} for ${path}` +
      (detail ? ` — ${detail}` : "")
  );

  error.name = "CanvasApiError";
  error.status = status;
  error.path = path;
  error.detail = detail;

  return error;
}

async function createErrorFromResponse(
  response,
  path
) {
  let detail = "";

  try {
    const errorBody = await response.text();

    if (errorBody) {
      detail = errorBody.slice(0, 300);
    }
  } catch {
    // Canvas did not return a readable error body.
  }

  return createCanvasApiError({
    status: response.status,
    path,
    detail
  });
}

export async function canvasFetchJson(path) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw await createErrorFromResponse(
      response,
      path
    );
  }

  return response.json();
}

export async function canvasFetchAll(path) {
  const allResults = [];
  let nextUrl = path;

  while (nextUrl) {
    const currentUrl = nextUrl;

    const response = await fetch(currentUrl, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw await createErrorFromResponse(
        response,
        currentUrl
      );
    }

    const pageResults = await response.json();

    if (Array.isArray(pageResults)) {
      allResults.push(...pageResults);
    }

    const linkHeader =
      response.headers.get("Link");

    nextUrl = getNextPageUrl(linkHeader);
  }

  return allResults;
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  const links = linkHeader.split(",");

  for (const link of links) {
    const match = link.match(
      /<([^>]+)>;\s*rel="([^"]+)"/
    );

    if (
      match &&
      match[2] === "next"
    ) {
      return match[1];
    }
  }

  return null;
}

export async function getCourseStudents(
  courseId
) {
  return canvasFetchAll(
    `/api/v1/courses/${courseId}` +
      `/users?enrollment_type[]=student` +
      `&include[]=enrollments` +
      `&per_page=100`
  );
}

export async function getRadarAssignments(
  courseId
) {
  /*
   * Load both:
   *
   * 1. Module items, which tell Wayfinder where each
   *    assignment appears in the course.
   *
   * 2. The authoritative course assignment list, which
   *    confirms that the assignment still exists.
   */
  const [modules, courseAssignments] =
    await Promise.all([
      canvasFetchAll(
        `/api/v1/courses/${courseId}` +
          `/modules?include[]=items` +
          `&per_page=100`
      ),

      canvasFetchAll(
        `/api/v1/courses/${courseId}` +
          `/assignments?per_page=100`
      )
    ]);

  const validAssignmentsById = new Map(
    courseAssignments.map((assignment) => [
      String(assignment.id),
      assignment
    ])
  );

  const radarAssignmentsById = new Map();

  for (const module of modules) {
    /*
     * Do not include assignments from unpublished modules.
     */
    if (module.published === false) {
      continue;
    }

    for (const item of module.items || []) {
      /*
       * Keep the existing Wayfinder behavior of tracking
       * Canvas module items represented as assignments.
       */
      if (item.type !== "Assignment") {
        continue;
      }

      const assignmentId =
        String(item.content_id || "");

      if (!assignmentId) {
        continue;
      }

      const assignment =
        validAssignmentsById.get(
          assignmentId
        );

      /*
       * Some older or migrated courses contain module
       * items that point to deleted or invalid assignments.
       *
       * These must be ignored or Canvas will reject the
       * entire bulk submission request.
       */
      if (!assignment) {
        console.warn(
          "Wayfinder ignored an orphaned module item:",
          {
            courseId,
            moduleId: module.id,
            moduleName: module.name,
            moduleItemId: item.id,
            moduleItemTitle: item.title,
            assignmentId
          }
        );

        continue;
      }

      /*
       * Do not include unpublished assignments in student
       * progress calculations.
       */
      if (assignment.published === false) {
        continue;
      }

      radarAssignmentsById.set(
        assignmentId,
        {
          id: assignment.id,
          name:
            assignment.name ||
            item.title ||
            "Untitled assignment",
          moduleId: module.id,
          moduleName:
            module.name ||
            "Unnamed module"
        }
      );
    }
  }

  return Array.from(
    radarAssignmentsById.values()
  );
}

export async function getSubmissionsForAssignment(
  courseId,
  assignmentId
) {
  return canvasFetchAll(
    `/api/v1/courses/${courseId}` +
      `/assignments/${assignmentId}` +
      `/submissions?student_ids[]=all` +
      `&per_page=100`
  );
}

function shouldUseSubmissionFallback(error) {
  if (
    error?.name !== "CanvasApiError" ||
    error?.status !== 403
  ) {
    return false;
  }

  /*
   * Canvas may return 403 for older-course permission
   * restrictions or for a rejected bulk assignment list.
   */
  return true;
}

async function getRadarSubmissionsFallback(
  courseId,
  assignmentIds
) {
  const allSubmissions = [];
  const failures = [];

  /*
   * Load assignments sequentially. This avoids sending
   * a large number of simultaneous requests to Canvas.
   */
  for (const assignmentId of assignmentIds) {
    try {
      const submissions =
        await getSubmissionsForAssignment(
          courseId,
          assignmentId
        );

      allSubmissions.push(
        ...submissions
      );
    } catch (error) {
      failures.push({
        assignmentId,
        error
      });

      console.warn(
        "Wayfinder could not load submissions " +
          `for assignment ${assignmentId}:`,
        error
      );
    }
  }

  /*
   * Never treat a failed submission request as though
   * every student simply failed to submit the assignment.
   * That would produce inaccurate progress percentages.
   */
  if (failures.length > 0) {
    const failedIds = failures
      .map(
        ({ assignmentId }) =>
          String(assignmentId)
      )
      .join(", ");

    const firstError =
      failures[0].error;

    throw createCanvasApiError({
      status:
        firstError?.status || 403,
      path:
        `/api/v1/courses/${courseId}` +
        `/assignments/:assignment_id/submissions`,
      detail:
        "Canvas denied submission access for " +
        `${failures.length} assignment(s): ` +
        failedIds
    });
  }

  return allSubmissions;
}

export async function getRadarSubmissions(
  courseId,
  assignmentIds
) {
  if (!Array.isArray(assignmentIds)) {
    return [];
  }

  const uniqueAssignmentIds = Array.from(
    new Set(
      assignmentIds
        .filter(Boolean)
        .map((assignmentId) =>
          String(assignmentId)
        )
    )
  );

  if (!uniqueAssignmentIds.length) {
    return [];
  }

  const params = new URLSearchParams();

  params.append(
    "student_ids[]",
    "all"
  );

  params.append(
    "per_page",
    "100"
  );

  for (
    const assignmentId
    of uniqueAssignmentIds
  ) {
    params.append(
      "assignment_ids[]",
      assignmentId
    );
  }

  const bulkPath =
    `/api/v1/courses/${courseId}` +
    `/students/submissions?` +
    params.toString();

  try {
    /*
     * Preferred method:
     *
     * Retrieve submissions for all selected assignments
     * through one paginated Canvas endpoint.
     */
    return await canvasFetchAll(
      bulkPath
    );
  } catch (error) {
    if (!shouldUseSubmissionFallback(error)) {
      throw error;
    }

    console.warn(
      "Wayfinder bulk submission request was denied. " +
        "Trying the assignment-by-assignment fallback.",
      error
    );

    /*
     * Some older courses reject the bulk endpoint but
     * still allow submission access through each
     * assignment's submissions endpoint.
     */
    return getRadarSubmissionsFallback(
      courseId,
      uniqueAssignmentIds
    );
  }
}
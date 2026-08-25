/*
 * Wayfinder - peopleApi.js
 *
 * Purpose:
 * Provides Canvas API access and Canvas-item resolution specifically
 * for the instructor-facing Student Radar on the People page.
 *
 * This file can retrieve:
 *
 * - Course students and their enrollments
 * - Course modules and module items
 * - Canvas assignments
 * - Student submissions for selected assignments
 *
 * getRadarAssignments() builds the selectable Required Items list from
 * published Canvas modules and published module items. It excludes text
 * headers and ordinary External URL items, but allows other Canvas item
 * types such as assignments and ExternalTool/LTI content.
 *
 * When possible, module items are matched to their backing Canvas
 * assignment using assignment_id, content_id, or an exact normalized
 * title match. The returned object keeps moduleItemId as the exact
 * module-item identity and assignmentId as optional grading metadata.
 *
 * Submission loading prefers Canvas's bulk student-submissions endpoint
 * and includes an assignment-by-assignment fallback when Canvas rejects
 * the bulk request with a permission-related 403 response.
 *
 * The file also creates detailed Canvas API errors so failures are not
 * silently mistaken for missing student work.
 */

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
  const [modules, courseAssignments] =
    await Promise.all([
      canvasFetchAll(
        `/api/v1/courses/${courseId}` +
          `/modules?include[]=items&per_page=100`
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

  const normalizeTitle = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const selectableItems = [];

  for (const module of modules) {
    /*
     * Do not expose items from unpublished modules.
     */
    if (module.published === false) {
      continue;
    }

    for (const item of module.items || []) {
      /*
       * Do not expose unpublished module items.
       */
      if (item.published === false) {
        continue;
      }

      const type =
        String(item.type || "")
          .trim()
          .toLowerCase();

      /*
       * Wayfinder should not offer organizational
       * text headers as required items.
       */
      if (
        type === "subheader" ||
        type === "text_header" ||
        type === "contextmoduleheader"
      ) {
        continue;
      }

      /*
       * Exclude ordinary external web links such as
       * YouTube videos and reference websites.
       *
       * ExternalTool is NOT excluded because LTI
       * assignments may use that Canvas item type.
       */
      if (
        type === "externalurl" ||
        type === "external_url"
      ) {
        continue;
      }

      let assignment = null;

      /*
       * Best case: Canvas directly exposes the
       * backing assignment ID.
       */
      if (item.assignment_id) {
        assignment =
          validAssignmentsById.get(
            String(item.assignment_id)
          ) || null;
      }

      /*
       * Assignment and some LTI module items expose
       * the real assignment through content_id.
       */
      if (!assignment && item.content_id) {
        assignment =
          validAssignmentsById.get(
            String(item.content_id)
          ) || null;
      }

      /*
       * Migrated courses, quizzes, discussions and
       * some LTI tools may use a different content ID.
       * Try an exact title match against Canvas's
       * authoritative assignment list.
       */
      if (!assignment) {
        const itemTitle =
          normalizeTitle(item.title);

        if (itemTitle) {
          assignment =
            courseAssignments.find(
              (candidate) =>
                normalizeTitle(
                  candidate.name
                ) === itemTitle
            ) || null;
        }
      }

      /*
       * The module-item ID identifies exactly what
       * the instructor selected.
       *
       * The assignment ID is optional and is used
       * later for submission/grade tracking.
       */
      selectableItems.push({
        id:
          `module:${item.id}`,

        moduleItemId:
          String(item.id),

        assignmentId:
          assignment?.id
            ? String(assignment.id)
            : null,

        name:
          item.title ||
          assignment?.name ||
          "Untitled item",

        type:
          item.type ||
          "Unknown",

        moduleId:
          String(module.id),

        moduleName:
          module.name ||
          "Unnamed module"
      });
    }
  }

  return selectableItems;
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
      .filter((assignmentId) =>
        /^\d+$/.test(assignmentId)
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
function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isRequiredTitle(title, requiredKeywords) {
  const lowered = cleanText(title).toLowerCase();

  return requiredKeywords.some((keyword) =>
    lowered.includes(keyword)
  );
}

export function isTextHeaderItem(item) {
  const type = String(item.type || "").toLowerCase();

  return (
    type === "subheader" ||
    type === "text_header" ||
    type === "contextmoduleheader"
  );
}

export function getAssignmentIdFromModuleItem(item) {
  const assignmentId = Number(item.assignment_id);

  if (Number.isFinite(assignmentId) && assignmentId > 0) {
    return assignmentId;
  }

  const contentId = Number(item.content_id);
  const type = String(item.type || "").toLowerCase();

  if (
    Number.isFinite(contentId) &&
    contentId > 0 &&
    (
      type === "assignment" ||
      type === "externaltool"
    )
  ) {
    return contentId;
  }

  return null;
}

export function getRequiredItemsForModule(
  module,
  moduleItems,
  rules,
  requiredKeywords,
  courseConfig = null
) {
  /*
   * Published Student Radar configuration is authoritative
   * when it exists.
   */
  if (Array.isArray(courseConfig?.requiredItems)) {
    const selectedAssignmentIds = new Set(
      courseConfig.requiredItems
        .filter(
          (configItem) =>
            Number(configItem.moduleId) === Number(module.id)
        )
        .map((configItem) => Number(configItem.assignmentId))
        .filter(Number.isFinite)
    );

    return moduleItems.filter((moduleItem) => {
      const assignmentId = getAssignmentIdFromModuleItem(moduleItem);
      const contentId = Number(moduleItem.content_id);

      return (
        (
          assignmentId !== null &&
          selectedAssignmentIds.has(Number(assignmentId))
        ) ||
        (
          Number.isFinite(contentId) &&
          selectedAssignmentIds.has(contentId)
        )
      );
    });
  }

  /*
   * Local custom rules are used when no published
   * course configuration exists.
   */
  const rule = rules[String(module.id)] || null;

  if (rule && rule.mode === "custom") {
    const selectedIds = new Set(
      (rule.requiredItemIds || []).map(String)
    );

    return moduleItems.filter((item) =>
      selectedIds.has(String(item.id))
    );
  }

  /*
   * Keyword detection is the final fallback.
   */
  return moduleItems.filter((item) => {
    if (isTextHeaderItem(item)) {
      return false;
    }

    return isRequiredTitle(
      item.title,
      requiredKeywords
    );
  });
}

export function calculateGradePercent(
  score,
  pointsPossible
) {
  return Math.round(
    (score / pointsPossible) * 100
  );
}

export function createStatusResult({
  item,
  title,
  status,
  complete = false,
  percent = null,
  detail = "",
  score = null,
  pointsPossible = null
}) {
  return {
    id: item.id,
    title,
    type: item.type || "Unknown",
    status,
    complete,
    percent,
    score,
    pointsPossible,
    detail
  };
}

export function analyzeItem(
  item,
  data,
  passingPercent
) {
  const title = cleanText(
    item.title || "Untitled item"
  );

  const assignmentId =
    getAssignmentIdFromModuleItem(item);

  if (!assignmentId) {
    return createStatusResult({
      item,
      title,
      status: "info_only",
      complete: false,
      detail:
        "Shown in tracker, but not counted toward progress."
    });
  }

  const assignment = data.assignmentMap.get(
    Number(assignmentId)
  );

  const submission = data.submissionMap.get(
    Number(assignmentId)
  );

  if (!assignment || assignment._cpt_error) {
    return createStatusResult({
      item,
      title,
      status: "error",
      detail:
        assignment?._cpt_error ||
        "Assignment data unavailable."
    });
  }

  if (
    !submission ||
    submission._cpt_error ||
    submission._cpt_unavailable
  ) {
    return createStatusResult({
      item,
      title,
      status: "waiting",
      detail:
        "Submission data unavailable for this view."
    });
  }

  const workflow = String(
    submission.workflow_state || ""
  ).toLowerCase();

  const submittedAt = submission.submitted_at;

  if (
    !submittedAt ||
    workflow === "unsubmitted"
  ) {
    return createStatusResult({
      item,
      title,
      status: "missing",
      detail: "No submission found."
    });
  }

  const score =
    submission.score === null ||
    submission.score === undefined
      ? null
      : Number(submission.score);

  if (
    score === null ||
    Number.isNaN(score)
  ) {
    return createStatusResult({
      item,
      title,
      status: "waiting",
      detail:
        "Submitted, waiting for grade."
    });
  }

  const pointsPossible = Number(
    assignment.points_possible
  );

  if (
    !pointsPossible ||
    Number.isNaN(pointsPossible)
  ) {
    return createStatusResult({
      item,
      title,
      status: "graded_no_points",
      detail:
        `Score ${score}; points possible unavailable.`
    });
  }

  const percent = calculateGradePercent(
    score,
    pointsPossible
  );

  const complete =
    percent >= passingPercent;

  return createStatusResult({
    item,
    title,
    status:
      complete
        ? "passed"
        : "below_passing",
    complete,
    percent,
    score,
    pointsPossible,
    detail:
      `${score}/${pointsPossible} = ${percent}%`
  });
}

export function analyzeModules(
  data,
  rules,
  requiredKeywords,
  passingPercent
) {
  return data.modules.map((module) => {
    const items =
      data.moduleItemsByModuleId[module.id] || [];

    const requiredItems =
      getRequiredItemsForModule(
        module,
        items,
        rules,
        requiredKeywords,
        data.courseConfig
      );

    const seenAssignmentIds = new Set();

const uniqueRequiredItems =
  requiredItems.filter((item) => {
    const assignmentId =
      getAssignmentIdFromModuleItem(item);

    /*
     * Keep informational/non-assignment items.
     * Only deduplicate items that resolve to the
     * same Canvas assignment.
     */
    if (!assignmentId) {
      return true;
    }

    const key = String(assignmentId);

    if (seenAssignmentIds.has(key)) {
      return false;
    }

    seenAssignmentIds.add(key);
    return true;
  });

const analyzedItems = uniqueRequiredItems.map(
  (item) =>
    analyzeItem(
      item,
      data,
      passingPercent
    )
);

    const progressItems =
      analyzedItems.filter(
        (item) =>
          item.status !== "info_only"
      );

    const total = progressItems.length;

    const complete =
      progressItems.filter(
        (item) => item.complete
      ).length;

    const percent =
      total === 0
        ? 0
        : Math.round(
            (complete / total) * 100
          );

    const rule =
      rules[String(module.id)] || null;

    return {
      id: module.id,
      name: module.name,
      ruleMode:
        Array.isArray(
          data.courseConfig?.requiredItems
        )
          ? "published"
          : rule?.mode || "keyword",
      total,
      complete,
      percent,
      items: analyzedItems
    };
  });
}
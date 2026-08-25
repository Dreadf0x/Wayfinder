/*
 * Wayfinder - studentSchedule.js
 *
 * Purpose:
 * Generates and displays the Student Radar Weekly Success Plan used to
 * help instructors schedule a student's remaining required work between
 * the current date and that student's configured End Date.
 *
 * The scheduler works only with required items that have not yet been
 * submitted. Submitted-but-ungraded work is intentionally excluded.
 *
 * Module names are inspected for workload values such as "(10H)",
 * "15 Hours", or "8 hrs". When module-hour information is available,
 * it is divided across that module's required items and used as an
 * internal scheduling weight.
 *
 * The file creates calendar weeks from today through the End Date and
 * uses weighted partitioning to distribute the ordered remaining work
 * as evenly as possible while preserving assignment/module order.
 *
 * It renders the Weekly Success Plan in a modal dialog, groups scheduled
 * items by module, supports printing, handles missing or invalid End
 * Dates, and can return focus to the student's End Date input.
 *
 * openSuccessPlan() exposes the schedule generator for a supplied person
 * and missing-item list, while bindStudentScheduleButtons() connects the
 * schedule buttons in Student Radar to the appropriate student data.
 */



function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStudentName(student) {
  return (
    student?.name ||
    student?.sortable_name ||
    "Unknown Student"
  );
}

function getStartOfToday() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function parseLocalDate(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function addDays(date, numberOfDays) {
  const result = new Date(date);

  result.setDate(
    result.getDate() + numberOfDays
  );

  return result;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

/*
 * Supports module names such as:
 *
 * Module 7: Wireless Networks (10H)
 * Networking Fundamentals - 15 Hours
 * Security Basics 8 hrs
 */
function parseModuleHours(moduleName) {
  const match = String(moduleName || "").match(
    /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);

  return Number.isFinite(hours) && hours > 0
    ? hours
    : null;
}

function createScheduleWeeks(
  startDate,
  endDate
) {
  const weeks = [];
  let weekStart = new Date(startDate);

  while (weekStart <= endDate) {
    const dayOfWeek = weekStart.getDay();

    /*
     * The first week begins today and ends Sunday.
     * Later weeks run Monday through Sunday.
     */
    const daysUntilSunday =
      dayOfWeek === 0
        ? 0
        : 7 - dayOfWeek;

    let weekEnd = addDays(
      weekStart,
      daysUntilSunday
    );

    if (weekEnd > endDate) {
      weekEnd = new Date(endDate);
    }

    const dayCount =
      Math.floor(
        (
          weekEnd.getTime() -
          weekStart.getTime()
        ) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    weeks.push({
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd),
      dayCount,
      items: [],
      estimatedHours: 0,
      unknownHourItems: 0,
      scheduleWeight: 0
    });

    weekStart = addDays(weekEnd, 1);
  }

  return weeks;
}


function buildModuleStats(
  assignments = []
) {
  const stats = new Map();

  for (const assignment of assignments) {
    const moduleName =
      assignment.moduleName ||
      "Other Required Items";

    if (!stats.has(moduleName)) {
      stats.set(moduleName, {
        moduleName,
        totalRequiredItems: 0,
        moduleHours:
          parseModuleHours(moduleName)
      });
    }

    stats.get(
      moduleName
    ).totalRequiredItems += 1;
  }

  return stats;
}

function addWeightsToMissingItems({
  missingItems,
  assignments
}) {
  const moduleStats =
    buildModuleStats(assignments);

  return missingItems.map((item) => {
    const moduleName =
      item.moduleName ||
      "Other Required Items";

    const stats =
      moduleStats.get(moduleName);

    const moduleHours =
      stats?.moduleHours ??
      parseModuleHours(moduleName);

    const totalRequiredItems =
      stats?.totalRequiredItems || 1;

    /*
     * Module hours are used only as an internal weight
     * for balancing work across the available dates.
     * Calculated hours are not displayed to students.
     */
    const estimatedHours =
      moduleHours !== null
        ? moduleHours /
          totalRequiredItems
        : null;

    return {
      ...item,
      moduleName,
      estimatedHours,

      scheduleWeight:
        estimatedHours !== null
          ? estimatedHours
          : 1
    };
  });
}


function getRangeWeight(
  prefixWeights,
  startIndex,
  endIndex
) {
  return (
    prefixWeights[endIndex] -
    prefixWeights[startIndex]
  );
}

/*
 * Divide an ordered list into contiguous weekly groups.
 *
 * This uses dynamic programming to find the division that
 * keeps every week as close as possible to the average
 * workload while preserving assignment/module order.
 */
function createBalancedPartitions(
  weightedItems,
  weeks
) {
  const itemCount =
    weightedItems.length;

  const weekCount =
    weeks.length;

  if (!itemCount || !weekCount) {
    return weeks.map(() => []);
  }

  const prefixWeights =
    new Array(itemCount + 1).fill(0);

  for (
    let index = 0;
    index < itemCount;
    index += 1
  ) {
    prefixWeights[index + 1] =
      prefixWeights[index] +
      weightedItems[index].scheduleWeight;
  }

  const totalWeight =
    prefixWeights[itemCount];

  const totalDays = weeks.reduce(
    (sum, week) =>
      sum + Math.max(1, week.dayCount || 1),
    0
  );

  /*
   * Each week's target workload is proportional to the
   * number of calendar days available in that week.
   */
  const targetWeights = weeks.map(
    (week) =>
      totalWeight *
      (
        Math.max(1, week.dayCount || 1) /
        totalDays
      )
  );

  /*
   * costs[weeksUsed][itemsUsed]
   *
   * Empty weeks are allowed. This is important when the
   * final week contains only one day and should receive
   * little or no new work.
   */
  const costs = Array.from(
    { length: weekCount + 1 },
    () =>
      new Array(itemCount + 1).fill(
        Number.POSITIVE_INFINITY
      )
  );

  const previousBreak = Array.from(
    { length: weekCount + 1 },
    () =>
      new Array(itemCount + 1).fill(-1)
  );

  costs[0][0] = 0;

  for (
    let weekNumber = 1;
    weekNumber <= weekCount;
    weekNumber += 1
  ) {
    const week =
      weeks[weekNumber - 1];

    const targetWeight =
      targetWeights[weekNumber - 1];

    /*
    * A very short final week is reserved for catching up,
    * checking submissions, and finishing anything left over.
    *
    * All planned required items must be assigned before it.
    */
    const isShortFinalWeek =
      weekNumber === weekCount &&
      weekCount > 1 &&
      week.dayCount < 3;

    for (
      let itemsUsed = 0;
      itemsUsed <= itemCount;
      itemsUsed += 1
    ) {
      /*
       * splitIndex may equal itemsUsed, which creates an
       * empty week. Assignment order remains unchanged.
       */
      /*
 * For a short final week, splitIndex must equal itemsUsed.
 * That creates an empty partition and forces all required
 * work into the earlier dated weeks.
 */
    const firstSplitIndex =
      isShortFinalWeek
        ? itemsUsed
        : 0;

    for (
      let splitIndex = firstSplitIndex;
      splitIndex <= itemsUsed;
      splitIndex += 1
    ) {
        const previousCost =
          costs[weekNumber - 1][
            splitIndex
          ];

        if (
          !Number.isFinite(previousCost)
        ) {
          continue;
        }

        const groupWeight =
          getRangeWeight(
            prefixWeights,
            splitIndex,
            itemsUsed
          );

        const difference =
          groupWeight - targetWeight;

        /*
         * Overloading a week is penalized more heavily
         * than leaving some unused capacity. This keeps
         * short final weeks from receiving large modules.
         */
        const overloadMultiplier =
          groupWeight > targetWeight
            ? 2.5
            : 1;

        const groupCost =
          difference *
          difference *
          overloadMultiplier;

        /*
         * Slightly prefer doing work earlier when two
         * distributions have nearly the same balance.
         */
        const latenessPenalty =
          groupWeight *
          (
            (weekNumber - 1) /
            Math.max(1, weekCount - 1)
          ) *
          0.01;

        const candidateCost =
          previousCost +
          groupCost +
          latenessPenalty;

        if (
          candidateCost <
          costs[weekNumber][itemsUsed]
        ) {
          costs[weekNumber][itemsUsed] =
            candidateCost;

          previousBreak[weekNumber][
            itemsUsed
          ] = splitIndex;
        }
      }
    }
  }

  const partitions =
    new Array(weekCount).fill(null);

  let weekNumber = weekCount;
  let itemsUsed = itemCount;

  while (weekNumber > 0) {
    const splitIndex =
      previousBreak[weekNumber][
        itemsUsed
      ];

    if (splitIndex < 0) {
      /*
       * Defensive fallback: place all work in order
       * across the available weeks.
       */
      return weeks.map(
        (_, index) =>
          index === 0
            ? [...weightedItems]
            : []
      );
    }

    partitions[weekNumber - 1] =
      weightedItems.slice(
        splitIndex,
        itemsUsed
      );

    itemsUsed = splitIndex;
    weekNumber -= 1;
  }

  return partitions;
}

function addItemToWeek(
  week,
  item
) {
  week.items.push(item);

  week.scheduleWeight +=
    item.scheduleWeight;

  if (item.estimatedHours !== null) {
    week.estimatedHours +=
      item.estimatedHours;
  } else {
    week.unknownHourItems += 1;
  }
}

function distributeItemsAcrossWeeks(
  weightedItems,
  weeks
) {
  if (
    !weeks.length ||
    !weightedItems.length
  ) {
    return weeks;
  }

  const partitions =
    createBalancedPartitions(
      weightedItems,
      weeks
    );

  partitions.forEach(
    (partition, weekIndex) => {
      const week = weeks[weekIndex];

      if (!week) {
        return;
      }

      for (const item of partition) {
        addItemToWeek(week, item);
      }
    }
  );

  return weeks;
}

function formatWeeklyTaskCount(week) {
  const itemCount = week.items.length;

  if (!itemCount) {
    return "Catch-up and review";
  }

  return `${itemCount} required item${
    itemCount === 1 ? "" : "s"
  }`;
}

 


function groupWeekItemsByModule(items) {
  const groups = [];

  for (const item of items) {
    const lastGroup =
      groups.at(-1);

    if (
      lastGroup &&
      lastGroup.moduleName ===
        item.moduleName
    ) {
      lastGroup.items.push(item);
    } else {
      groups.push({
        moduleName: item.moduleName,
        items: [item]
      });
    }
  }

  return groups;
}

function renderWeek(week, index) {
  const moduleGroups =
    groupWeekItemsByModule(
      week.items
    );

  const moduleHtml =
    moduleGroups.length
      ? moduleGroups
          .map(
            (group) => `
              <section
                class="cpt-schedule-module"
                >
                <h4>
                    ${escapeHtml(
                        group.moduleName
                    )}
                    </h4>

                    <p class="cpt-schedule-module-instruction">
                        Before completing the required items below, complete
                        all learning materials that appear above them in Canvas.
                        This schedule lists only the required submissions.
                    </p>

                    <ul
                    class="cpt-schedule-task-list"
                    >
                  ${group.items
                    .map(
                      (item) => `
                        <li>
                          <span
                            class="cpt-schedule-checkbox"
                            aria-hidden="true"
                          ></span>

                          <span>
                            ${escapeHtml(
                              item.name ||
                              "Unnamed required item"
                            )}
                          </span>
                        </li>
                      `
                    )
                    .join("")}
                </ul>
              </section>
            `
          )
          .join("")
      : `
        <p
          class="cpt-schedule-empty-week"
        >
          Catch-up, review, and completion week.
        </p>
      `;

  return `
    <article class="cpt-schedule-week">
      <div
        class="cpt-schedule-week-header"
      >
        <div>
          <h3>Week ${index + 1}</h3>

          <span>
            ${escapeHtml(
              formatShortDate(
                week.startDate
              )
            )}
            –
            ${escapeHtml(
              formatShortDate(
                week.endDate
              )
            )}
          </span>
        </div>

        <strong>
            ${escapeHtml(
                formatWeeklyTaskCount(week)
            )}
        </strong>
      </div>

      ${moduleHtml}
    </article>
  `;
}

function removeExistingSchedule() {
  document
    .querySelector(
      ".cpt-student-schedule-overlay"
    )
    ?.remove();
}

function closeSchedule() {
  removeExistingSchedule();

  document.body.classList.remove(
    "cpt-printing-student-schedule"
  );
}

function createModal({
  title,
  body,
  showPrintButton = false,
  focusEndDateStudentId = null
}) {
  removeExistingSchedule();

  const overlay =
    document.createElement("div");

  overlay.className =
    "cpt-student-schedule-overlay";

  overlay.innerHTML = `
    <section
      class="cpt-student-schedule-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpt-schedule-dialog-title"
    >
      <header
        class="cpt-schedule-modal-header"
      >
        <h2
          id="cpt-schedule-dialog-title"
        >
          ${escapeHtml(title)}
        </h2>

        <button
          type="button"
          class="cpt-schedule-close"
          aria-label="Close schedule"
          title="Close"
        >
          ×
        </button>
      </header>

      <div
        class="cpt-schedule-modal-body"
      >
        ${body}
      </div>

      <footer
        class="cpt-schedule-modal-actions"
      >
        ${
          focusEndDateStudentId
            ? `
              <button
                type="button"
                class="cpt-schedule-set-date"
                data-student-id="${escapeHtml(
                  focusEndDateStudentId
                )}"
              >
                Set End Date
              </button>
            `
            : ""
        }

        ${
          showPrintButton
            ? `
              <button
                type="button"
                class="cpt-schedule-print"
              >
                Print Schedule
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="cpt-schedule-cancel"
        >
          Close
        </button>
      </footer>
    </section>
  `;

  document.body.appendChild(
    overlay
  );

  const modal = overlay.querySelector(
    ".cpt-student-schedule-modal"
  );

  overlay
    .querySelector(
      ".cpt-schedule-close"
    )
    ?.addEventListener(
      "click",
      closeSchedule
    );

  overlay
    .querySelector(
      ".cpt-schedule-cancel"
    )
    ?.addEventListener(
      "click",
      closeSchedule
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeSchedule();
      }
    }
  );

  overlay
    .querySelector(
      ".cpt-schedule-set-date"
    )
    ?.addEventListener(
      "click",
      (event) => {
        const studentId =
          event.currentTarget.dataset
            .studentId;

        closeSchedule();

        const input =
          document.querySelector(
            `.cpt-end-date[data-student-id="${CSS.escape(
              studentId
            )}"]`
          );

        input?.focus();
        input?.showPicker?.();
      }
    );

  overlay
    .querySelector(
      ".cpt-schedule-print"
    )
    ?.addEventListener(
      "click",
      () => {
        document.body.classList.add(
          "cpt-printing-student-schedule"
        );

        window.print();
      }
    );

  const handleEscape = (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeSchedule();

    document.removeEventListener(
      "keydown",
      handleEscape
    );
  };

  document.addEventListener(
    "keydown",
    handleEscape
  );

  window.addEventListener(
    "afterprint",
    () => {
      document.body.classList.remove(
        "cpt-printing-student-schedule"
      );
    },
    { once: true }
  );

  requestAnimationFrame(() => {
    modal
      ?.querySelector(
        "button, input, [tabindex]"
      )
      ?.focus();
  });
}

function openStudentSchedule({
  student,
  endDateValue,
  assignments
}) {
  const studentName =
    getStudentName(student);

  if (!endDateValue) {
    createModal({
      title: "End Date Required",
      body: `
        <div
          class="cpt-schedule-message"
        >
          <p>
            Enter an end date for
            <strong>
              ${escapeHtml(studentName)}
            </strong>
            before generating a weekly schedule.
          </p>
        </div>
      `,
      focusEndDateStudentId:
        String(student.id)
    });

    return;
  }

  const endDate =
    parseLocalDate(endDateValue);

  const today =
    getStartOfToday();

  if (
    !endDate ||
    endDate <= today
  ) {
    createModal({
      title:
        "Future End Date Required",
      body: `
        <div
          class="cpt-schedule-message"
        >
          <p>
            The end date for
            <strong>
              ${escapeHtml(studentName)}
            </strong>
            must be later than today.
          </p>
        </div>
      `,
      focusEndDateStudentId:
        String(student.id)
    });

    return;
  }

  /*
   * Schedule only work that has not been submitted.
   * Submitted-but-ungraded work is intentionally excluded.
   */
  const missingItems =
    student.missingSubmissionItems ||
    [];

  if (!missingItems.length) {
    createModal({
      title: "No Work to Schedule",
      body: `
        <div
          class="cpt-schedule-message"
        >
          <p>
            ${escapeHtml(studentName)}
            has submitted all currently selected
            required items.
          </p>
        </div>
      `
    });

    return;
  }

  const weeks =
    createScheduleWeeks(
      today,
      endDate
    );

  const weightedItems =
    addWeightsToMissingItems({
      missingItems,
      assignments
    });

  distributeItemsAcrossWeeks(
    weightedItems,
    weeks
  );

  const summaryParts = [
    `${missingItems.length} required item${
        missingItems.length === 1
        ? ""
        : "s"
    } remaining`,
    `${weeks.length} week${
        weeks.length === 1
        ? ""
        : "s"
    } remaining`
    ];  

 

  createModal({
    title:
      `${studentName} — Weekly Success Plan`,
    showPrintButton: true,
    body: `
      <div
        class="cpt-student-schedule-sheet"
      >
        <header
          class="cpt-schedule-print-header"
        >
          <h1>Weekly Success Plan</h1>

          <div
            class="cpt-schedule-student-name"
          >
            ${escapeHtml(studentName)}
          </div>

          <div
            class="cpt-schedule-date-range"
          >
            ${escapeHtml(
              formatDate(today)
            )}
            through
            ${escapeHtml(
              formatDate(endDate)
            )}
          </div>

          <p>
            ${escapeHtml(
              summaryParts.join(" • ")
            )}
          </p>
        </header>

        <div
          class="cpt-schedule-weeks"
        >
          ${weeks
            .map(renderWeek)
            .join("")}
        </div>

        <footer
          class="cpt-schedule-print-footer"
        >
          <p>
            Complete all learning material for each listed module.
            The checklist shows required items that have not yet
            been submitted.
        </p>

          
        </footer>
      </div>
    `
  });
}

export function openSuccessPlan({
  personName = "Student",
  personId = "self",
  endDateValue = "",
  missingItems = [],
  assignments = []
} = {}) {
  openStudentSchedule({
    student: {
      id: personId,
      name: personName,
      missingSubmissionItems: missingItems
    },
    endDateValue,
    assignments
  });
}

export function bindStudentScheduleButtons({
  panel,
  students = [],
  endDates = {},
  assignments = []
} = {}) {
  const studentsById = new Map(
    students.map((student) => [
      String(student.id),
      student
    ])
  );

  panel
    .querySelectorAll(
      ".cpt-radar-schedule-button[data-student-id]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const studentId =
            button.dataset.studentId;

          const student =
            studentsById.get(
              String(studentId)
            );

          if (!student) {
            return;
          }

          openStudentSchedule({
            student,
            endDateValue:
              endDates[
                String(studentId)
              ] || "",
            assignments
          });
        }
      );
    });
}
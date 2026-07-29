import { initializePeopleView } from "./people/peopleApp.js";
import {
  createShell as createShellUi,
  createCollapsedTab as createCollapsedTabUi,
  renderError as renderErrorUi
} from "./ui/shell.js";
import {
  getAssignmentIdFromModuleItem,
  getRequiredItemsForModule,
  analyzeModules
} from "./progress/engine.js";
import { canvasFetch, canvasFetchAll } from "./api/canvas.js";
import {
  loadUiState,
  saveUiState
} from "./storage/rules.js";
import { renderTracker } from "./ui/panel.js";
import {
  applyTheme,
  THEMES,
  getTheme
} from "./themes/themes.js";
import { openSuccessPlan } from "./people/studentSchedule.js";
import { loadCourseConfig } from "./shared/loadCourseConfig.js";

export function initializeApp() {
  "use strict";

  const isPeoplePage =
    /\/courses\/\d+\/users/.test(window.location.pathname);

  if (isPeoplePage) {
    initializePeopleView();
    return;
  }

  const EXTENSION_ID = "cpt-progress-tracker";
  const TAB_ID = "cpt-progress-tab";
  const PASSING_PERCENT = 80;
  const REQUIRED_KEYWORDS = [
    "training",
    "important",
    "assessment"
  ];

  const appState = {
    courseId: null,
    data: null,
    modules: [],
    collapsed: false,
    theme: THEMES.ubtech.id,
    scheduleEndDate: ""
  };

  function getCourseIdFromUrl() {
    const match =
      window.location.pathname.match(
        /\/courses\/(\d+)\/modules/
      );

    return match ? match[1] : null;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getStatusInfo(item) {
    switch (item.status) {
      case "passed":
        return {
          icon: "✓",
          label: "Passed",
          className: "cpt-item-complete"
        };
      case "below_passing":
        return {
          icon: "!",
          label: "Below 80%",
          className: "cpt-item-warning"
        };
      case "waiting":
        return {
          icon: "…",
          label: "Waiting for grade",
          className: "cpt-item-waiting"
        };
      case "missing":
        return {
          icon: "○",
          label: "Missing",
          className: "cpt-item-incomplete"
        };
      case "info_only":
        return {
          icon: "i",
          label: "Info only",
          className: "cpt-item-muted"
        };
      default:
        return {
          icon: "!",
          label: "Error",
          className: "cpt-item-error"
        };
    }
  }

  /*
   * Kept local so Wayfinder does not depend on the old
   * instructor-oriented item renderer export.
   */
  function renderProgressItem(item, escape) {
    const statusInfo = getStatusInfo(item);
    const gradeText =
      item.percent === null
        ? ""
        : ` <span class="cpt-grade">(${item.percent}%)</span>`;

    return `
      <li class="${statusInfo.className}">
        <span class="cpt-icon">${statusInfo.icon}</span>
        <span>
          <strong>${escape(item.title)}</strong>${gradeText}
          <small>
            ${escape(statusInfo.label)} ·
            ${escape(item.detail || "")}
          </small>
        </span>
      </li>
    `;
  }

  function removeExistingUI() {
    document.getElementById(EXTENSION_ID)?.remove();
    document.getElementById(TAB_ID)?.remove();
  }

  function renderProgressTracker(
    wrapper,
    courseId,
    data,
    analyzedModules
  ) {
    renderTracker({
      wrapper,
      courseId,
      data,
      analyzedModules,
      isInstructor: false,
      showSettingsForModuleId: null,
      renderSettingsPanel: () => "",
      renderItem: renderProgressItem,
      escapeHtml,
      bindEvents,
      debugMode: false,
      passingPercent: PASSING_PERCENT,
      theme: appState.theme,
      themes: THEMES,
      themeLogo: getTheme(appState.theme).logo,
      scheduleEndDate: appState.scheduleEndDate
    });
  }

  function createShell() {
    return createShellUi({
      extensionId: EXTENSION_ID,
      tabId: TAB_ID,
      collapsed: appState.collapsed,
      createCollapsedTab,
      bindHeaderButtons
    });
  }

  function createCollapsedTab() {
    createCollapsedTabUi({
      tabId: TAB_ID,
      onOpen: async () => {
        appState.collapsed = false;

        await saveUiState(appState.courseId, {
          collapsed: appState.collapsed,
          theme: appState.theme,
          scheduleEndDate:
            appState.scheduleEndDate
        });

        await reloadDataAndRender();
      }
    });
  }

  function bindHeaderButtons() {
    document
      .getElementById("cpt-refresh")
      ?.addEventListener("click", init);

    document
      .getElementById("cpt-collapse")
      ?.addEventListener(
        "click",
        async () => {
          appState.collapsed = true;

          await saveUiState(appState.courseId, {
            collapsed: appState.collapsed,
            theme: appState.theme,
            scheduleEndDate:
              appState.scheduleEndDate
          });

          removeExistingUI();
          createCollapsedTab();
        }
      );
  }

  function renderError(wrapper, error) {
    renderErrorUi({
      wrapper,
      error,
      escapeHtml,
      bindHeaderButtons
    });
  }

  async function loadModuleItems(
    courseId,
    moduleIds,
    moduleItemsByModuleId
  ) {
    const uniqueModuleIds = Array.from(
      new Set(
        moduleIds
          .map(Number)
          .filter(Number.isFinite)
      )
    );

    await Promise.all(
      uniqueModuleIds.map(async (moduleId) => {
        if (
          Array.isArray(
            moduleItemsByModuleId[moduleId]
          )
        ) {
          return;
        }

        moduleItemsByModuleId[moduleId] =
          await canvasFetchAll(
            `/api/v1/courses/${courseId}/modules/${moduleId}/items?per_page=100`
          );
      })
    );
  }

  async function resolveModuleItemAssignmentId(
    courseId,
    moduleItem
  ) {
    if (moduleItem.assignment_id) {
      return Number(moduleItem.assignment_id);
    }

    const type = String(
      moduleItem.type || ""
    ).toLowerCase();

    if (type === "quiz") {
      /*
       * Canvas does not always include content_id on module quiz
       * items. In those cases the quiz ID is still present in the
       * API URL or HTML URL, so check every available source.
       */
      const quizUrl = String(
        moduleItem.url ||
        moduleItem.html_url ||
        moduleItem.external_url ||
        ""
      );

      const quizUrlMatch =
        quizUrl.match(/\/quizzes\/(\d+)/i);

      const quizId = Number(
        moduleItem.content_id ||
        quizUrlMatch?.[1]
      );

      if (Number.isFinite(quizId) && quizId > 0) {
        const quiz = await canvasFetch(
          `/api/v1/courses/${courseId}/quizzes/${quizId}`
        ).catch((error) => {
          console.warn(
            "Wayfinder could not load the Canvas quiz while resolving its assignment ID:",
            moduleItem,
            error
          );

          return null;
        });

        const quizAssignmentId = Number(
          quiz?.assignment_id
        );

        if (
          Number.isFinite(quizAssignmentId) &&
          quizAssignmentId > 0
        ) {
          return quizAssignmentId;
        }
      }

      /*
       * Final compatibility fallback: Classic Quizzes are backed by
       * assignments. Search Canvas assignments by the exact quiz title
       * when the module item does not expose a usable quiz ID.
       */
      const title = cleanText(
        moduleItem.title
      );

      if (title) {
        const matches = await canvasFetchAll(
          `/api/v1/courses/${courseId}/assignments?per_page=100&search_term=${encodeURIComponent(title)}`
        ).catch((error) => {
          console.warn(
            "Wayfinder could not search assignments for the Canvas quiz:",
            moduleItem,
            error
          );

          return [];
        });

        const exactMatch = matches.find(
          (assignment) =>
            cleanText(assignment.name)
              .toLowerCase() ===
            title.toLowerCase()
        );

        const matchedAssignmentId = Number(
          exactMatch?.id
        );

        if (
          Number.isFinite(matchedAssignmentId) &&
          matchedAssignmentId > 0
        ) {
          return matchedAssignmentId;
        }
      }

      console.warn(
        "Wayfinder could not resolve a Canvas quiz to its backing assignment:",
        moduleItem
      );

      return null;
    }

    const assignmentId =
      getAssignmentIdFromModuleItem(
        moduleItem
      );

    return Number.isFinite(
      Number(assignmentId)
    )
      ? Number(assignmentId)
      : null;
  }

  async function resolveConfiguredItems(
    courseId,
    courseConfig,
    moduleItemsByModuleId
  ) {
    if (
      !Array.isArray(courseConfig?.requiredItems)
    ) {
      return [];
    }

    const resolvedItems = await Promise.all(
      courseConfig.requiredItems.map(
        async (configItem) => {
          const moduleItems =
            moduleItemsByModuleId[
              Number(configItem.moduleId)
            ] || [];

          const configuredId =
            Number(configItem.assignmentId);

          const configuredName =
            cleanText(configItem.name)
              .toLowerCase();

          const matchedItem =
            moduleItems.find((moduleItem) => {
              const directAssignmentId =
                getAssignmentIdFromModuleItem(
                  moduleItem
                );

              return (
                Number(moduleItem.id) ===
                  configuredId ||
                Number(directAssignmentId) ===
                  configuredId ||
                (
                  configuredName &&
                  cleanText(moduleItem.title)
                    .toLowerCase() ===
                    configuredName
                )
              );
            });

          if (!matchedItem) {
            console.warn(
              "Wayfinder could not match a published required item:",
              configItem
            );
            return null;
          }

          const resolvedAssignmentId =
            await resolveModuleItemAssignmentId(
              courseId,
              matchedItem
            );

          if (!resolvedAssignmentId) {
            console.warn(
              "Wayfinder matched a module item but could not resolve its assignment ID:",
              matchedItem
            );
            return null;
          }

          /*
           * Cache the resolved assignment ID on the module item.
           * engine.js checks assignment_id first, so Classic
           * Quizzes now participate in the normal progress logic.
           */
          matchedItem.assignment_id =
            Number(resolvedAssignmentId);

          return {
            configItem,
            moduleItem: matchedItem,
            assignmentId:
              Number(resolvedAssignmentId)
          };
        }
      )
    );

    return resolvedItems.filter(Boolean);
  }

  async function getCanvasData(courseId) {
    const start = performance.now();

    const [user, modules] = await Promise.all([
      canvasFetch(
        "/api/v1/users/self/profile"
      ).catch(() => ({
        name: "current user"
      })),

      canvasFetchAll(
        `/api/v1/courses/${courseId}/modules?per_page=100`
      )
    ]);

    const moduleItemsByModuleId = {};

    const configurationModule =
      modules.find((module) =>
        String(module.name || "")
          .trim()
          .toLowerCase()
          .includes(
            "wayfinder configuration"
          )
      );

    if (configurationModule) {
      await loadModuleItems(
        courseId,
        [configurationModule.id],
        moduleItemsByModuleId
      );
    }

    const loadedCourseConfig =
      await loadCourseConfig(
        courseId,
        modules,
        moduleItemsByModuleId
      ).catch((error) => {
        console.error(
          "Wayfinder could not load the shared course configuration:",
          error
        );

        return null;
      });

    let courseConfig = loadedCourseConfig;
    let assignmentIds = [];

    if (
      Array.isArray(
        loadedCourseConfig?.requiredItems
      )
    ) {
      const configuredModuleIds =
        loadedCourseConfig.requiredItems
          .map(
            (item) =>
              Number(item.moduleId)
          )
          .filter(Number.isFinite);

      await loadModuleItems(
        courseId,
        configuredModuleIds,
        moduleItemsByModuleId
      );

      const resolvedItems =
        await resolveConfiguredItems(
          courseId,
          loadedCourseConfig,
          moduleItemsByModuleId
        );

      assignmentIds = Array.from(
        new Set(
          resolvedItems.map(
            (item) => item.assignmentId
          )
        )
      );

      /*
       * Normalize the downloaded configuration so engine.js
       * receives genuine Canvas assignment IDs even when Radar
       * stored a module-item/content identifier.
       */
      courseConfig = {
        ...loadedCourseConfig,
        requiredItems:
          resolvedItems.map(
            ({
              configItem,
              assignmentId
            }) => ({
              ...configItem,
              assignmentId
            })
          )
      };
    } else {
      /*
       * Compatibility fallback for courses that have no
       * published Wayfinder configuration.
       */
      await loadModuleItems(
        courseId,
        modules.map((module) => module.id),
        moduleItemsByModuleId
      );

      const requiredItems =
        modules.flatMap((module) =>
          getRequiredItemsForModule(
            module,
            moduleItemsByModuleId[
              module.id
            ] || [],
            {},
            REQUIRED_KEYWORDS,
            null
          )
        );

      assignmentIds = Array.from(
        new Set(
          requiredItems
            .map(
              getAssignmentIdFromModuleItem
            )
            .filter(Boolean)
        )
      );
    }

    const [assignments, submissions] =
      await Promise.all([
        assignmentIds.length
          ? Promise.all(
              assignmentIds.map((id) =>
                canvasFetch(
                  `/api/v1/courses/${courseId}/assignments/${id}`
                ).catch((error) => ({
                  id,
                  _cpt_error: error.message
                }))
              )
            )
          : Promise.resolve([]),

        assignmentIds.length
          ? Promise.all(
              assignmentIds.map((id) =>
                canvasFetch(
                  `/api/v1/courses/${courseId}/assignments/${id}/submissions/self`
                ).catch((error) => ({
                  assignment_id: id,
                  _cpt_error: error.message
                }))
              )
            )
          : Promise.resolve([])
      ]);

    return {
      user,
      role: "student",
      courseConfig,
      modules,
      moduleItemsByModuleId,
      assignmentIds,
      assignmentMap: new Map(
        assignments.map((assignment) => [
          Number(assignment.id),
          assignment
        ])
      ),
      submissionMap: new Map(
        submissions.map((submission) => [
          Number(submission.assignment_id),
          submission
        ])
      ),
      elapsedMs:
        Math.round(performance.now() - start)
    };
  }

  function bindEvents(wrapper) {
    bindHeaderButtons();

    const scheduleEndDateInput =
      wrapper.querySelector(
        "#cpt-student-plan-end-date"
      );

    const scheduleButton =
      wrapper.querySelector(
        "#cpt-student-plan-button"
      );

    scheduleEndDateInput?.addEventListener(
      "change",
      async () => {
        appState.scheduleEndDate =
          scheduleEndDateInput.value;

        await saveUiState(appState.courseId, {
          collapsed: appState.collapsed,
          theme: appState.theme,
          scheduleEndDate:
            appState.scheduleEndDate
        });
      }
    );

    scheduleButton?.addEventListener(
      "click",
      async () => {
        appState.scheduleEndDate =
          scheduleEndDateInput?.value || "";

        await saveUiState(appState.courseId, {
          collapsed: appState.collapsed,
          theme: appState.theme,
          scheduleEndDate:
            appState.scheduleEndDate
        });

        const scheduleItems =
          appState.modules.flatMap(
            (module) =>
              module.items
                .filter(
                  (item) =>
                    item.status !==
                    "info_only"
                )
                .map((item) => ({
                  id: item.id,
                  name: item.title,
                  moduleName: module.name,
                  status: item.status
                }))
          );

        const missingItems =
          scheduleItems
            .filter(
              (item) =>
                item.status === "missing"
            )
            .map(
              ({ status, ...item }) => item
            );

        const assignments =
          scheduleItems.map(
            ({ status, ...item }) => item
          );

        openSuccessPlan({
          personName:
            appState.data?.user?.name ||
            appState.data?.user?.login_id ||
            "Student",
          personId: "self",
          endDateValue:
            appState.scheduleEndDate,
          missingItems,
          assignments
        });
      }
    );

    const themeButton =
      wrapper.querySelector(
        "#cpt-theme-button"
      );

    const themeMenu =
      wrapper.querySelector(
        "#cpt-theme-menu"
      );

    themeButton?.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (themeMenu) {
          themeMenu.hidden =
            !themeMenu.hidden;
        }
      }
    );

    themeMenu
      ?.querySelectorAll("[data-theme]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            appState.theme =
              button.dataset.theme;

            applyTheme(appState.theme);
            themeMenu.hidden = true;

            await saveUiState(
              appState.courseId,
              {
                collapsed:
                  appState.collapsed,
                theme: appState.theme,
                scheduleEndDate:
                  appState.scheduleEndDate
              }
            );

            rerender();
          }
        );
      });
  }

  function analyzeCurrentData() {
    return analyzeModules(
      appState.data,
      {},
      REQUIRED_KEYWORDS,
      PASSING_PERCENT
    );
  }

  function rerender() {
    const wrapper =
      document.getElementById(
        EXTENSION_ID
      );

    appState.modules =
      analyzeCurrentData();

    renderProgressTracker(
      wrapper,
      appState.courseId,
      appState.data,
      appState.modules
    );
  }

  async function reloadDataAndRender() {
    const wrapper = createShell();

    if (
      !wrapper &&
      appState.collapsed
    ) {
      return;
    }

    appState.data =
      await getCanvasData(
        appState.courseId
      );

    appState.modules =
      analyzeCurrentData();

    renderProgressTracker(
      wrapper,
      appState.courseId,
      appState.data,
      appState.modules
    );
  }

  async function init() {
    const courseId =
      getCourseIdFromUrl();

    if (!courseId) {
      const wrapper = createShell();

      renderError(
        wrapper,
        new Error(
          "Could not determine course ID from URL."
        )
      );

      return;
    }

    appState.courseId = courseId;

    const uiState =
      await loadUiState(courseId);

    appState.collapsed =
      Boolean(uiState.collapsed);

    appState.theme =
      getTheme(uiState.theme).id;

    appState.scheduleEndDate =
      String(
        uiState.scheduleEndDate || ""
      );

    applyTheme(appState.theme);

    const wrapper = createShell();

    if (
      !wrapper &&
      appState.collapsed
    ) {
      return;
    }

    try {
      appState.data =
        await getCanvasData(courseId);

      appState.modules =
        analyzeCurrentData();

      renderProgressTracker(
        wrapper,
        courseId,
        appState.data,
        appState.modules
      );
    } catch (error) {
      renderError(wrapper, error);
    }
  }

  setTimeout(init, 1000);
}

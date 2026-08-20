export const WAYFINDER_CONFIG_SCHEMA_VERSION = 1;

export const WAYFINDER_CONFIG_FILE_NAME =
  "wayfinder-course.json";

function normalizeRequiredItem(item) {
  return {
    /*
     * The Canvas module-item ID identifies exactly
     * which item the instructor selected.
     */
    moduleItemId:
      item.moduleItemId === null ||
      item.moduleItemId === undefined
        ? null
        : String(item.moduleItemId),

    /*
     * The Canvas assignment ID is optional.
     * It is used for grades/submissions when the
     * selected module item has an assignment backing it.
     */
    assignmentId:
      item.assignmentId === null ||
      item.assignmentId === undefined
        ? null
        : String(item.assignmentId),

    name: String(
      item.name ??
      "Unnamed Item"
    ),

    type:
      item.type === null ||
      item.type === undefined
        ? null
        : String(item.type),

    moduleId:
      item.moduleId === null ||
      item.moduleId === undefined
        ? null
        : String(item.moduleId),

    moduleName:
      item.moduleName === null ||
      item.moduleName === undefined
        ? null
        : String(item.moduleName)
  };
}

export function createCourseConfig({
  courseId,
  requiredItems = [],
  settings = {}
}) {
  if (!courseId) {
    throw new Error(
      "A Canvas course ID is required."
    );
  }

  return {
    schemaVersion:
      WAYFINDER_CONFIG_SCHEMA_VERSION,

    courseId:
      String(courseId),

    updatedAt:
      new Date().toISOString(),

    requiredItems:
      requiredItems.map(
        normalizeRequiredItem
      ),

    settings: {
      passingPercent:
        Number(
          settings.passingPercent ?? 80
        ),

      theme:
        String(
          settings.theme ?? "ubtech"
        )
    }
  };
}

export function serializeCourseConfig(
  config
) {
  return JSON.stringify(
    config,
    null,
    2
  );
}

export function downloadCourseConfig(
  config,
  fileName =
    WAYFINDER_CONFIG_FILE_NAME
) {
  const jsonText =
    serializeCourseConfig(config);

  const blob = new Blob(
    [jsonText],
    {
      type: "application/json"
    }
  );

  const objectUrl =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}
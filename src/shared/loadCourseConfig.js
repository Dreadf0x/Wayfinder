import {
  canvasFetch
} from "../api/canvas.js";

const CONFIG_MODULE_NAME =
  "Wayfinder Configuration";

const CONFIG_MODULE_ITEM_TITLE =
  "Wayfinder Course Data";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function validateRequiredItems(
  requiredItems
) {
  if (!Array.isArray(requiredItems)) {
    throw new Error(
      "The Wayfinder configuration does not contain a requiredItems array."
    );
  }

  for (const item of requiredItems) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      throw new Error(
        "The Wayfinder configuration contains an invalid required item."
      );
    }

    if (!item.assignmentId) {
      throw new Error(
        "A required item is missing its assignmentId."
      );
    }

    if (!item.moduleId) {
      throw new Error(
        "A required item is missing its moduleId."
      );
    }
  }
}

function validateCourseConfig(
  config,
  courseId
) {
  if (
    !config ||
    typeof config !== "object"
  ) {
    throw new Error(
      "The Wayfinder course configuration is not a valid JSON object."
    );
  }

  if (config.schemaVersion !== 1) {
    throw new Error(
      `Unsupported Wayfinder schema version: ${config.schemaVersion}`
    );
  }

  if (
    String(config.courseId) !==
    String(courseId)
  ) {
    throw new Error(
      [
        "The Wayfinder configuration belongs to another course.",
        `Expected course ${courseId},`,
        `but received ${config.courseId}.`
      ].join(" ")
    );
  }

  validateRequiredItems(
    config.requiredItems
  );

  return config;
}

function findConfigModule(
  modules
) {
  const expectedName =
    normalizeText(
      CONFIG_MODULE_NAME
    );

  return (
    modules.find(
      (module) =>
        normalizeText(
          module.name
        ) === expectedName
    ) || null
  );
}

function findConfigModuleItem({
  modules,
  moduleItemsByModuleId
}) {
  const expectedTitle =
    normalizeText(
      CONFIG_MODULE_ITEM_TITLE
    );

  /*
   * Prefer the item inside the dedicated
   * Wayfinder Configuration module.
   */
  const configModule =
    findConfigModule(
      modules
    );

  if (configModule) {
    const moduleItems =
      moduleItemsByModuleId[
        configModule.id
      ] || [];

    const matchingItem =
      moduleItems.find(
        (item) =>
          item.type === "File" &&
          normalizeText(
            item.title
          ) === expectedTitle
      );

    if (matchingItem) {
      return matchingItem;
    }
  }

  /*
   * Fallback: search every module in case the
   * configuration module was renamed.
   */
  for (const module of modules) {
    const moduleItems =
      moduleItemsByModuleId[
        module.id
      ] || [];

    const matchingItem =
      moduleItems.find(
        (item) =>
          item.type === "File" &&
          normalizeText(
            item.title
          ) === expectedTitle
      );

    if (matchingItem) {
      return matchingItem;
    }
  }

  return null;
}

async function loadCanvasFileMetadata(
  moduleItem
) {
  /*
   * File-type module items normally include an API
   * URL for the corresponding Canvas File object.
   */
  if (moduleItem?.url) {
    return canvasFetch(
      moduleItem.url
    );
  }

  /*
   * Fallback when Canvas only provides content_id.
   */
  if (moduleItem?.content_id) {
    return canvasFetch(
      `/api/v1/files/${encodeURIComponent(
        moduleItem.content_id
      )}`
    );
  }

  throw new Error(
    "The Wayfinder module item does not contain a Canvas file reference."
  );
}

async function downloadConfigJson(
  fileMetadata
) {
  if (!fileMetadata?.url) {
    throw new Error(
      "Canvas did not provide a download URL for the Wayfinder configuration file."
    );
  }

  const response =
    await fetch(
      fileMetadata.url,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept:
            "application/json,text/plain,*/*"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      [
        "Wayfinder could not download the shared course configuration.",
        `HTTP ${response.status} ${response.statusText}.`
      ].join(" ")
    );
  }

  /*
   * Parse the text ourselves so a slightly unusual
   * Canvas content-type does not prevent JSON parsing.
   */
  const responseText =
    await response.text();

  try {
    return JSON.parse(
      responseText
    );
  } catch (error) {
    throw new Error(
      `The downloaded Wayfinder file contains invalid JSON: ${error.message}`
    );
  }
}

export async function loadCourseConfig(
  courseId,
  modules,
  moduleItemsByModuleId
) {
  console.info(
    "Wayfinder is searching Canvas Modules for the shared course configuration."
  );

  const moduleItem =
    findConfigModuleItem({
      modules,
      moduleItemsByModuleId
    });

  if (!moduleItem) {
    console.info(
      "Wayfinder Course Data was not found in Canvas Modules. Using existing local/default behavior."
    );

    return null;
  }

  console.info(
    "Wayfinder configuration module item found:",
    moduleItem
  );

  const fileMetadata =
    await loadCanvasFileMetadata(
      moduleItem
    );

  console.info(
    "Wayfinder configuration file metadata loaded:",
    fileMetadata
  );

  const config =
    await downloadConfigJson(
      fileMetadata
    );

  const validatedConfig =
    validateCourseConfig(
      config,
      courseId
    );

  console.info(
    "Wayfinder shared course configuration loaded successfully:",
    validatedConfig
  );

  return validatedConfig;
}
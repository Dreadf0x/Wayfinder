import {
  serializeCourseConfig,
  WAYFINDER_CONFIG_FILE_NAME
} from "./courseConfig.js";

const CONFIG_FOLDER_PATH =
  "Wayfinder";

const CONFIG_MODULE_NAME =
  "Wayfinder Configuration";

const CONFIG_MODULE_ITEM_TITLE =
  "Wayfinder Course Data";

function getCanvasCsrfToken() {
  const match =
    document.cookie.match(
      /(?:^|;\s*)_csrf_token=([^;]+)/
    );

  return match
    ? decodeURIComponent(match[1])
    : "";
}

function createCanvasHeaders({
  includeContentType = false
} = {}) {
  const headers = {
    Accept: "application/json",
    "X-Requested-With":
      "XMLHttpRequest"
  };

  const csrfToken =
    getCanvasCsrfToken();

  if (csrfToken) {
    headers["X-CSRF-Token"] =
      csrfToken;
  }

  if (includeContentType) {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded;charset=UTF-8";
  }

  return headers;
}

async function readErrorResponse(
  response
) {
  const responseText =
    await response
      .text()
      .catch(() => "");

  return [
    `HTTP ${response.status} ${response.statusText}`,
    responseText
  ]
    .filter(Boolean)
    .join(": ");
}

function getNextLink(
  linkHeader
) {
  if (!linkHeader) {
    return null;
  }

  for (
    const linkPart of
    linkHeader.split(",")
  ) {
    const sections =
      linkPart.split(";");

    if (
      sections.length >= 2 &&
      sections[1].trim() ===
        'rel="next"'
    ) {
      return sections[0]
        .trim()
        .slice(1, -1);
    }
  }

  return null;
}

async function canvasFetchAll(
  initialPath
) {
  let nextPath =
    initialPath;

  const results = [];

  while (nextPath) {
    const response =
      await fetch(nextPath, {
        method: "GET",
        credentials: "include",
        headers:
          createCanvasHeaders()
      });

    if (!response.ok) {
      throw new Error(
        await readErrorResponse(
          response
        )
      );
    }

    const pageResults =
      await response.json();

    if (
      Array.isArray(pageResults)
    ) {
      results.push(
        ...pageResults
      );
    }

    nextPath =
      getNextLink(
        response.headers.get(
          "Link"
        )
      );
  }

  return results;
}

function createConfigBlob(
  config
) {
  const json =
    serializeCourseConfig(
      config
    );

  return new Blob(
    [json],
    {
      type: "application/json"
    }
  );
}

async function requestCanvasFileUpload({
  courseId,
  config
}) {
  const path =
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/files`;

  const body =
    new URLSearchParams();

  body.set(
    "name",
    WAYFINDER_CONFIG_FILE_NAME
  );

  body.set(
    "content_type",
    "application/json"
  );

  body.set(
    "parent_folder_path",
    CONFIG_FOLDER_PATH
  );

  body.set(
    "on_duplicate",
    "overwrite"
  );

  const response =
    await fetch(path, {
      method: "POST",
      credentials: "include",
      headers:
        createCanvasHeaders({
          includeContentType: true
        }),
      body
    });

  if (!response.ok) {
    throw new Error(
      [
        "Could not request the Canvas file upload.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  return response.json();
}

async function uploadConfigFile({
  uploadRequest,
  config
}) {
  if (
    !uploadRequest?.upload_url
  ) {
    throw new Error(
      "Canvas did not return a file upload URL."
    );
  }

  const formData =
    new FormData();

  const uploadParams =
    uploadRequest.upload_params ||
    {};

  for (
    const [key, value] of
    Object.entries(
      uploadParams
    )
  ) {
    formData.append(
      key,
      String(value)
    );
  }

  formData.append(
    "file",
    createConfigBlob(config),
    WAYFINDER_CONFIG_FILE_NAME
  );

  const response =
    await fetch(
      uploadRequest.upload_url,
      {
        method: "POST",
        credentials: "include",
        body: formData
      }
    );

  if (!response.ok) {
    throw new Error(
      [
        "Could not upload the Wayfinder configuration file.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  const uploadedFile =
    await response.json();

  if (!uploadedFile?.id) {
    throw new Error(
      "Canvas uploaded the file but did not return a file ID."
    );
  }

  return uploadedFile;
}

async function getCourseModules(
  courseId
) {
  return canvasFetchAll(
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules?per_page=100`
  );
}

async function createConfigModule(
  courseId
) {
  const path =
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules`;

  const body =
    new URLSearchParams();

  body.set(
    "module[name]",
    CONFIG_MODULE_NAME
  );

  body.set(
    "module[published]",
    "true"
  );

  const response =
    await fetch(path, {
      method: "POST",
      credentials: "include",
      headers:
        createCanvasHeaders({
          includeContentType: true
        }),
      body
    });

  if (!response.ok) {
    throw new Error(
      [
        "The file uploaded, but Wayfinder could not create its Canvas module.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  return response.json();
}

async function publishConfigModule({
  courseId,
  moduleId
}) {
  const path =
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules/${encodeURIComponent(
      moduleId
    )}`;

  const body =
    new URLSearchParams();

  body.set(
    "module[published]",
    "true"
  );

  const response =
    await fetch(path, {
      method: "PUT",
      credentials: "include",
      headers:
        createCanvasHeaders({
          includeContentType: true
        }),
      body
    });

  if (!response.ok) {
    throw new Error(
      [
        "Wayfinder found the configuration module but could not publish it.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  return response.json();
}

async function findOrCreateConfigModule(
  courseId
) {
  const modules =
    await getCourseModules(
      courseId
    );

  const existingModule =
    modules.find(
      (module) =>
        String(
          module.name || ""
        ).trim() ===
        CONFIG_MODULE_NAME
    );

  if (existingModule) {
    if (!existingModule.published) {
      return publishConfigModule({
        courseId,
        moduleId:
          existingModule.id
      });
    }

    return existingModule;
  }

  return createConfigModule(
    courseId
  );
}

async function getModuleItems({
  courseId,
  moduleId
}) {
  return canvasFetchAll(
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules/${encodeURIComponent(
      moduleId
    )}/items?per_page=100`
  );
}

async function createConfigModuleItem({
  courseId,
  moduleId,
  fileId
}) {
  const path =
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules/${encodeURIComponent(
      moduleId
    )}/items`;

  const body =
    new URLSearchParams();

  body.set(
    "module_item[title]",
    CONFIG_MODULE_ITEM_TITLE
  );

  body.set(
    "module_item[type]",
    "File"
  );

  body.set(
    "module_item[content_id]",
    String(fileId)
  );

  body.set(
    "module_item[published]",
    "true"
  );

  const response =
    await fetch(path, {
      method: "POST",
      credentials: "include",
      headers:
        createCanvasHeaders({
          includeContentType: true
        }),
      body
    });

  if (!response.ok) {
    throw new Error(
      [
        "The file uploaded, but Wayfinder could not add it to the Canvas module.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  return response.json();
}

async function updateConfigModuleItem({
  courseId,
  moduleId,
  moduleItemId,
  fileId
}) {
  const path =
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/modules/${encodeURIComponent(
      moduleId
    )}/items/${encodeURIComponent(
      moduleItemId
    )}`;

  const body =
    new URLSearchParams();

  body.set(
    "module_item[title]",
    CONFIG_MODULE_ITEM_TITLE
  );

  body.set(
    "module_item[content_id]",
    String(fileId)
  );

  body.set(
    "module_item[published]",
    "true"
  );

  const response =
    await fetch(path, {
      method: "PUT",
      credentials: "include",
      headers:
        createCanvasHeaders({
          includeContentType: true
        }),
      body
    });

  if (!response.ok) {
    throw new Error(
      [
        "The file uploaded, but Wayfinder could not update its Canvas module item.",
        await readErrorResponse(
          response
        )
      ].join(" ")
    );
  }

  return response.json();
}

async function linkFileToConfigModule({
  courseId,
  uploadedFile
}) {
  const configModule =
    await findOrCreateConfigModule(
      courseId
    );

  if (!configModule?.id) {
    throw new Error(
      "Canvas did not return an ID for the Wayfinder configuration module."
    );
  }

  const moduleItems =
    await getModuleItems({
      courseId,
      moduleId:
        configModule.id
    });

  const existingItem =
    moduleItems.find(
      (item) =>
        item.type === "File" &&
        (
          String(
            item.title || ""
          ).trim() ===
            CONFIG_MODULE_ITEM_TITLE ||
          String(
            item.content_id || ""
          ) ===
            String(
              uploadedFile.id
            )
        )
    );

  let moduleItem;

  if (existingItem) {
    moduleItem =
      await updateConfigModuleItem({
        courseId,
        moduleId:
          configModule.id,
        moduleItemId:
          existingItem.id,
        fileId:
          uploadedFile.id
      });
  } else {
    moduleItem =
      await createConfigModuleItem({
        courseId,
        moduleId:
          configModule.id,
        fileId:
          uploadedFile.id
      });
  }

  return {
    module:
      configModule,
    moduleItem
  };
}

export async function publishCourseConfigToCanvas({
  courseId,
  config
}) {
  if (!courseId) {
    throw new Error(
      "A Canvas course ID is required."
    );
  }

  if (
    !config ||
    typeof config !== "object"
  ) {
    throw new Error(
      "A valid Wayfinder course configuration is required."
    );
  }

  console.info(
    "Wayfinder is publishing the shared course configuration."
  );

  const uploadRequest =
    await requestCanvasFileUpload({
      courseId,
      config
    });

  const uploadedFile =
    await uploadConfigFile({
      uploadRequest,
      config
    });

  console.info(
    "Wayfinder configuration file uploaded:",
    uploadedFile
  );

  const moduleLink =
    await linkFileToConfigModule({
      courseId,
      uploadedFile
    });

  console.info(
    "Wayfinder configuration linked to Canvas Modules:",
    moduleLink
  );

  return {
    file:
      uploadedFile,
    module:
      moduleLink.module,
    moduleItem:
      moduleLink.moduleItem
  };
}
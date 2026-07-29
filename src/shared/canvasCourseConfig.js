import {
  serializeCourseConfig,
  WAYFINDER_CONFIG_FILE_NAME
} from "./courseConfig.js";

function getCanvasCsrfToken() {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) =>
      part.startsWith("_csrf_token=")
    );

  if (!cookie) {
    return null;
  }

  const encodedToken =
    cookie.substring(
      "_csrf_token=".length
    );

  try {
    return decodeURIComponent(
      encodedToken
    );
  } catch {
    return encodedToken;
  }
}

async function getCanvasErrorMessage(
  response,
  fallbackMessage
) {
  try {
    const body =
      await response.json();

    if (Array.isArray(body?.errors)) {
      const messages =
        body.errors
          .map((error) =>
            error?.message ||
            error?.error ||
            String(error)
          )
          .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }

    if (body?.message) {
      return String(body.message);
    }

    if (body?.error) {
      return String(body.error);
    }
  } catch {
    // Canvas did not return JSON.
  }

  return (
    `${fallbackMessage} ` +
    `Canvas returned HTTP ${response.status}.`
  );
}

async function requestCanvasUpload({
  courseId,
  fileName,
  fileSize
}) {
  const csrfToken =
    getCanvasCsrfToken();

  const body =
    new URLSearchParams();

  body.set(
    "name",
    fileName
  );

  body.set(
    "size",
    String(fileSize)
  );

  body.set(
    "content_type",
    "application/json"
  );

  body.set(
    "on_duplicate",
    "overwrite"
  );

  body.set(
  "parent_folder_path",
  "Wayfinder"
);

  const headers = {
    "Content-Type":
      "application/x-www-form-urlencoded;charset=UTF-8",

    Accept:
      "application/json"
  };

  if (csrfToken) {
    headers["X-CSRF-Token"] =
      csrfToken;
  }

  const response = await fetch(
    `/api/v1/courses/${encodeURIComponent(
      courseId
    )}/files`,
    {
      method: "POST",
      credentials: "same-origin",
      headers,
      body
    }
  );

  if (!response.ok) {
    const message =
      await getCanvasErrorMessage(
        response,
        "Canvas could not prepare the Wayfinder configuration upload."
      );

    throw new Error(message);
  }

  const uploadData =
    await response.json();

  if (
    !uploadData?.upload_url ||
    !uploadData?.upload_params
  ) {
    throw new Error(
      "Canvas did not return the required upload information."
    );
  }

  return uploadData;
}

async function sendFileToCanvas({
  uploadUrl,
  uploadParams,
  file
}) {
  const formData =
    new FormData();

  for (
    const [key, value]
    of Object.entries(uploadParams)
  ) {
    formData.append(
      key,
      String(value)
    );
  }

  formData.append(
    "file",
    file,
    file.name
  );

  const response = await fetch(
    uploadUrl,
    {
      method: "POST",
      body: formData,
      redirect: "follow"
    }
  );

  if (!response.ok) {
    const message =
      await getCanvasErrorMessage(
        response,
        "Canvas could not upload the Wayfinder configuration."
      );

    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return {
      success: true,
      status: response.status,
      finalUrl: response.url
    };
  }
}

export async function publishCourseConfigToCanvas({
  courseId,
  config,
  fileName =
    WAYFINDER_CONFIG_FILE_NAME
}) {
  if (!courseId) {
    throw new Error(
      "A Canvas course ID is required."
    );
  }

  if (!config) {
    throw new Error(
      "A Wayfinder course configuration is required."
    );
  }

  const jsonText =
    serializeCourseConfig(config);

  const file = new File(
    [jsonText],
    fileName,
    {
      type: "application/json"
    }
  );

  const uploadData =
    await requestCanvasUpload({
      courseId,
      fileName,
      fileSize: file.size
    });

  const result =
    await sendFileToCanvas({
      uploadUrl:
        uploadData.upload_url,

      uploadParams:
        uploadData.upload_params,

      file
    });

  console.info(
    "Wayfinder configuration uploaded to Canvas:",
    result
  );

  return result;
}
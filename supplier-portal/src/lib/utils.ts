export function formatDeadline(value?: string) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function requiredRemaining(
  fields: Array<{ field_id: string; required: boolean; type: string }>,
  values: Record<string, unknown>,
) {
  return fields.filter((field) => {
    if (!field.required) return false;
    const value = values[field.field_id];
    if (field.type === "url_list") {
      return !Array.isArray(value) || !value.filter(Boolean).length;
    }
    if (field.type === "boolean") {
      return typeof value !== "boolean";
    }
    if (field.type === "file_upload") {
      return !Array.isArray(value) || !value.length;
    }
    return value === undefined || value === null || value === "";
  }).length;
}

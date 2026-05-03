import FileUpload from "./FileUpload";
import { FormFieldDefinition } from "../types";

export default function FormField({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const baseClassName =
    "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";

  return (
    <label className="block text-sm text-slate-700">
      <span className="font-medium text-slate-900">{field.label}</span>
      {field.required ? <span className="ml-2 text-xs text-amber-700">Required</span> : null}
      {field.hint ? <span className="mt-1 block text-xs text-slate-500">{field.hint}</span> : null}

      {field.type === "text" ? (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={baseClassName}
        />
      ) : null}

      {field.type === "textarea" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`${baseClassName} min-h-[140px]`}
        />
      ) : null}

      {field.type === "number" ? (
        <input
          type="number"
          value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          disabled={disabled}
          className={baseClassName}
        />
      ) : null}

      {field.type === "dropdown" ? (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={baseClassName}
        >
          <option value="">Select one</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === "boolean" ? (
        <div className="mt-3 flex gap-3">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              onClick={() => !disabled && onChange(option)}
              disabled={disabled}
              className={`rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                value === option
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {option ? "Yes" : "No"}
            </button>
          ))}
        </div>
      ) : null}

      {field.type === "url_list" ? (
        <div className="mt-3 space-y-3">
          {(Array.isArray(value) ? value : [""]).map((item, index) => (
            <input
              key={`${field.field_id}-${index}`}
              type="url"
              value={typeof item === "string" ? item : ""}
              onChange={(event) => {
                const next = Array.isArray(value) ? [...value] : [""];
                next[index] = event.target.value;
                onChange(next);
              }}
              disabled={disabled}
              className={baseClassName}
              placeholder="https://"
            />
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange([...(Array.isArray(value) ? value : [""]), ""])}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
            >
              Add link
            </button>
          )}
        </div>
      ) : null}

      {field.type === "file_upload" ? (
        <div className="mt-3">
          <FileUpload
            files={Array.isArray(value) ? (value as File[]) : []}
            onChange={onChange as (files: File[]) => void}
          />
        </div>
      ) : null}
    </label>
  );
}

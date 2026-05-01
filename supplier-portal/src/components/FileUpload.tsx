export default function FileUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4">
      <label className="block cursor-pointer text-sm text-slate-700">
        <span className="font-medium text-slate-900">Attach supporting files</span>
        <span className="mt-1 block text-xs text-slate-500">
          Upload certifications, decks, or pricing attachments.
        </span>
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
        />
      </label>
      <div className="mt-3 space-y-2">
        {files.map((file) => (
          <div
            key={`${file.name}-${file.size}`}
            className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          >
            {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        ))}
        {!files.length ? <p className="text-xs text-slate-500">No files selected.</p> : null}
      </div>
    </div>
  );
}

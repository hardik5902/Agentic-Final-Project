export interface ChatMessage {
  id: string;
  role: "buyer" | "assistant";
  text: string;
}

export default function ChatInterface({
  messages,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  messages: ChatMessage[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
        RFQ creation chat
      </p>
      <div className="mt-5 flex min-h-[360px] flex-col gap-4 rounded-[20px] border border-white/10 bg-slate-900/70 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 ${
              message.role === "buyer"
                ? "ml-auto bg-cyan-400 text-slate-950"
                : "bg-white/8 text-slate-100"
            }`}
          >
            {message.text}
          </div>
        ))}
        {!messages.length && (
          <p className="text-sm text-slate-400">
            Start with a short description of what you need to source.
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe the project or answer the current question"
          className="min-h-[104px] flex-1 rounded-[18px] border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="self-end rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          Send
        </button>
      </div>
    </section>
  );
}

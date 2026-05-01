export default function RatingInput({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`h-8 w-8 rounded-full text-sm ${
            value && rating <= value
              ? "bg-amber-300 text-slate-950"
              : "bg-white/10 text-slate-300"
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

type Props = {
  start: Date;
  end: Date;
  onFix: () => void; // navigate to fixer page
};

export default function MissingPostingsCard({ start, end, onFix }: Props) {
  const s = format(start, "yyyy-MM-dd");
  const e = format(end, "yyyy-MM-dd");

  const { data } = useQuery({
    queryKey: ["missing-postings", s, e],
    queryFn: async () => {
      const res = await fetch(`/api/quality/missing-postings?start=${s}&end=${e}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch quality data");
      return (await res.json()) as { data: { day: string; department: string }[] };
    },
  });

  const gaps = data?.data ?? [];
  const count = gaps.length;

  return (
    <div className="rounded-xl border bg-white p-4 md:p-5 shadow-sm">
      <div className="text-sm text-slate-600">Data Health</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">
        {count === 0 ? "All departments posted" : `${count} missing posting${count > 1 ? "s" : ""}`}
      </div>
      {count > 0 && (
        <>
          <div className="mt-2 text-xs text-slate-600">
            Example: {gaps[0].department} · {gaps[0].day}
            {count > 1 ? " …" : ""}
          </div>
          <button
            onClick={onFix}
            className="mt-3 inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Fix missing postings
          </button>
        </>
      )}
    </div>
  );
}

// client/src/components/transactions/bulk-income-modal.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Row = {
  departmentId: string;
  departmentName: string;
  ssp: string;          // string to make typing easy while user edits
  usd: string;
  providerId?: string;  // used when usd > 0
};

export default function BulkIncomeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // load deps & providers
  const { data: departments = [] } = useQuery({ queryKey: ["/api/departments"] });
  const { data: providers = [] }   = useQuery({ queryKey: ["/api/insurance-providers"] });

  // shared date for all rows
  const [date, setDate] = useState<Date | undefined>(new Date());

  // rows – one per department
  const initialRows: Row[] = useMemo(
    () =>
      (departments as any[]).map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        ssp: "",
        usd: "",
        providerId: undefined,
      })),
    [departments]
  );

  const [rows, setRows] = useState<Row[]>(initialRows);

  // reset rows whenever modal opens or deps change
  useEffect(() => {
    if (open) setRows(initialRows);
  }, [open, initialRows]);

  // quick helpers
  const totalSSP = rows.reduce((s, r) => s + (parseFloat(r.ssp) || 0), 0);
  const totalUSD = rows.reduce((s, r) => s + (parseFloat(r.usd) || 0), 0);

  // BULK mutation – try bulk API first, then fallback to per-item POSTs
  const bulkMutation = useMutation({
    mutationFn: async (payload: any[]) => {
      try {
        const { data } = await api.post("/api/transactions/bulk", { items: payload });
        return data;
      } catch {
        // fallback: per-item POSTs
        await Promise.all(
          payload.map((item) => api.post("/api/transactions", item))
        );
        return { ok: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Saved",
        description: "Daily income entries saved successfully.",
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to save entries.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!date) {
      toast({ title: "Pick a date", description: "Please choose the transaction date.", variant: "destructive" });
      return;
    }

    // Build payload: one transaction for each non-zero amount
    const iso = format(date, "yyyy-MM-dd");
    const items: any[] = [];

    rows.forEach((r) => {
      const ssp = parseFloat(r.ssp) || 0;
      const usd = parseFloat(r.usd) || 0;

      if (ssp > 0) {
        items.push({
          type: "income",
          departmentId: r.departmentId,
          amount: ssp,
          currency: "SSP",
          date: iso,
          description: `Daily income - ${r.departmentName}`,
        });
      }

      if (usd > 0) {
        items.push({
          type: "income",
          departmentId: r.departmentId,
          insuranceProviderId: r.providerId || undefined,
          amount: usd,
          currency: "USD",
          date: iso,
          description: `Insurance income - ${r.departmentName}`,
        });
      }
    });

    if (items.length === 0) {
      toast({ title: "Nothing to save", description: "Enter at least one amount.", variant: "destructive" });
      return;
    }

    bulkMutation.mutate(items);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Daily Bulk Income</DialogTitle>
          <DialogDescription>
            Enter today’s totals for each department. You can fill SSP and/or USD (with insurance).
          </DialogDescription>
        </DialogHeader>

        {/* Date picker */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="p-2 w-auto bg-white border shadow-lg">
              <DatePicker
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <div className="ml-auto text-sm text-slate-600">
            Totals — <span className="font-medium">SSP {Math.round(totalSSP).toLocaleString()}</span> &nbsp;·&nbsp;
            <span className="font-medium">USD {Math.round(totalUSD).toLocaleString()}</span>
          </div>
        </div>

        {/* Grid */}
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr] gap-0 bg-slate-50 text-xs font-medium text-slate-600">
            <div className="p-2">Department</div>
            <div className="p-2 text-right">SSP</div>
            <div className="p-2 text-right">USD</div>
            <div className="p-2">Insurance (for USD)</div>
          </div>

          <div className="max-h-[48vh] overflow-auto">
            {rows.map((row, i) => (
              <div key={row.departmentId} className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr] items-center border-t">
                <div className="px-3 py-2 text-sm">{row.departmentName}</div>

                <div className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={row.ssp}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, "");
                      setRows((prev) => {
                        const copy = [...prev];
                        copy[i] = { ...copy[i], ssp: v };
                        return copy;
                      });
                    }}
                    className="text-right"
                  />
                </div>

                <div className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={row.usd}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, "");
                      setRows((prev) => {
                        const copy = [...prev];
                        copy[i] = { ...copy[i], usd: v };
                        return copy;
                      });
                    }}
                    className="text-right"
                  />
                </div>

                <div className="px-3 py-2">
                  <Select
                    value={row.providerId || ""}
                    onValueChange={(val) => {
                      setRows((prev) => {
                        const copy = [...prev];
                        copy[i] = { ...copy[i], providerId: val || undefined };
                        return copy;
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="(optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(None)</SelectItem>
                      {(providers as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((r) => r.map((x) => ({ ...x, ssp: "", usd: "", providerId: undefined })))
              }
            >
              Clear All
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // copy first provider to all rows (handy if 1 insurer handles most USD)
                const first = rows.find((r) => r.providerId)?.providerId;
                if (!first) return;
                setRows((r) => r.map((x) => ({ ...x, providerId: x.providerId || first })));
              }}
            >
              Copy Provider Down
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Saving..." : "Save Daily Income"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Upload } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

import { SubscriberPayload } from "@/client-api/types/subscribers.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ImportSubscribersModalProps {
  open: boolean;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (subscribers: SubscriberPayload[]) => void;
}

const normalizeRow = (
  row: Record<string, unknown>
): SubscriberPayload | null => {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replace(/\s+/g, ""),
      value
    ])
  );
  const phoneNumber = String(
    normalized.phonenumber || normalized.phone || normalized.mobile || ""
  ).trim();
  const firstName = String(
    normalized.firstname || normalized.name || normalized.first || ""
  ).trim();

  if (!phoneNumber || !firstName) return null;

  return {
    phoneNumber,
    firstName,
    lastName: String(normalized.lastname || normalized.last || "").trim(),
    tags: String(normalized.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
};

export default function ImportSubscribersModal({
  open,
  isImporting,
  onOpenChange,
  onImport
}: ImportSubscribersModalProps) {
  const [rows, setRows] = useState<SubscriberPayload[]>([]);

  const handleFile = async (file?: File) => {
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    setRows(rawRows.map(normalizeRow).filter(Boolean) as SubscriberPayload[]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import subscribers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <Input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Required columns: phoneNumber and firstName. Optional columns:
              lastName, tags.
            </p>
          </div>

          {rows.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-lg bg-white shadow-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-3">Phone</th>
                    <th className="p-3">First name</th>
                    <th className="p-3">Last name</th>
                    <th className="p-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={`${row.phoneNumber}-${index}`}
                      className="border-t"
                    >
                      <td className="p-3">{row.phoneNumber}</td>
                      <td className="p-3">{row.firstName}</td>
                      <td className="p-3">{row.lastName || "-"}</td>
                      <td className="p-3">{row.tags?.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!rows.length}
            isLoading={isImporting}
            onClick={() => onImport(rows)}
          >
            <Upload className="size-4" />
            Import {rows.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

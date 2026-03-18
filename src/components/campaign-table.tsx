"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercentage } from "@/lib/utils";

interface CampaignRow {
  name: string;
  created_at?: string;
  emails_sent: number;
  replies: number;
  positive_replies: number;
  meeting_requests: number;
  emails_per_meeting: number;
  conversion_rate: number;
}

interface CampaignTableProps {
  title?: string;
  data: CampaignRow[];
}

type SortKey = keyof CampaignRow;

const columns: { key: SortKey; label: string; format: "string" | "number" | "percentage" | "ratio" | "date" }[] = [
  { key: "name", label: "Name", format: "string" },
  { key: "created_at", label: "Created At", format: "date" },
  { key: "emails_sent", label: "Emails Sent", format: "number" },
  { key: "replies", label: "Replies", format: "number" },
  { key: "positive_replies", label: "Positive Replies", format: "number" },
  { key: "meeting_requests", label: "Meeting Requests", format: "number" },
  { key: "emails_per_meeting", label: "Emails / Meeting", format: "ratio" },
  { key: "conversion_rate", label: "Conv. Rate", format: "percentage" },
];

function formatCell(value: unknown, fmt: string): string {
  if (value === null || value === undefined) return "-";
  if (fmt === "string") return String(value);
  if (fmt === "date") {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  if (fmt === "percentage") return formatPercentage(Number(value));
  if (fmt === "ratio") return Number(value).toFixed(1);
  return formatNumber(Number(value));
}

export function CampaignTable({ title, data }: CampaignTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("emails_sent");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [data, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No data available.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.format === "string" ? "font-medium" : ""}>
                      {formatCell(row[col.key], col.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

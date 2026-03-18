"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, Key, Loader2, ExternalLink, Plus, X, Pencil, Check } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Client {
  id: number;
  name: string;
  client_status: "active" | "churned";
  api_token_masked: string;
  has_api_token: boolean;
  google_sheet_url: string | null;
  is_active: boolean;
}

type SortField = "name" | "client_status";
type SortDir = "asc" | "desc";

export default function ClientsPage() {
  const { data, isLoading, mutate } = useSWR<{ clients: Client[] }>(
    "/api/clients",
    fetcher
  );

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardName, setOnboardName] = useState("");
  const [onboardToken, setOnboardToken] = useState("");
  const [onboardSheetUrl, setOnboardSheetUrl] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editSheetUrl, setEditSheetUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const clients = data?.clients ?? [];

  const filtered = useMemo(() => {
    let list = clients;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, search, sortField, sortDir]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  const handleToggleStatus = useCallback(
    async (client: Client) => {
      const newStatus = client.client_status === "active" ? "churned" : "active";
      setTogglingId(client.id);
      try {
        const res = await fetch("/api/clients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: client.id,
            client_status: newStatus,
          }),
        });
        if (res.ok) {
          mutate();
        }
      } catch (err) {
        console.error("Failed to toggle status:", err);
      } finally {
        setTogglingId(null);
      }
    },
    [mutate]
  );

  const handleGenerateAll = useCallback(async () => {
    setGeneratingAll(true);
    setGenerateResult(null);
    try {
      const res = await fetch("/api/clients/generate-tokens", {
        method: "POST",
      });
      const json = await res.json();
      setGenerateResult(json.message ?? "Done");
      mutate();
    } catch (err) {
      setGenerateResult(
        err instanceof Error ? err.message : "Failed to generate tokens"
      );
    } finally {
      setGeneratingAll(false);
    }
  }, [mutate]);

  const handleGenerateOne = useCallback(
    async (workspaceId: number) => {
      setGeneratingId(workspaceId);
      try {
        const res = await fetch(
          `/api/clients/generate-tokens?workspace_id=${workspaceId}`,
          { method: "POST" }
        );
        if (res.ok) {
          mutate();
        }
      } catch (err) {
        console.error("Failed to generate token:", err);
      } finally {
        setGeneratingId(null);
      }
    },
    [mutate]
  );

  const startEdit = useCallback((client: Client) => {
    setEditingId(client.id);
    setEditName(client.name);
    setEditToken(""); // don't prefill token for security
    setEditSheetUrl(client.google_sheet_url ?? "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditToken("");
    setEditSheetUrl("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        workspace_id: editingId,
        name: editName.trim(),
        google_sheet_url: editSheetUrl.trim() || null,
      };
      // Only send api_token if user actually typed a new one
      if (editToken.trim()) {
        body.api_token = editToken.trim();
      }
      const res = await fetch("/api/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        cancelEdit();
        mutate();
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  }, [editingId, editName, editToken, editSheetUrl, mutate, cancelEdit]);

  const handleOnboard = useCallback(async () => {
    if (!onboardName.trim() || !onboardToken.trim()) return;
    setOnboarding(true);
    setOnboardError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: onboardName.trim(),
          api_token: onboardToken.trim(),
          google_sheet_url: onboardSheetUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOnboardError(json.error || "Failed to onboard client");
      } else {
        setOnboardName("");
        setOnboardToken("");
        setOnboardSheetUrl("");
        setShowOnboard(false);
        mutate();
      }
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : "Failed to onboard");
    } finally {
      setOnboarding(false);
    }
  }, [onboardName, onboardToken, onboardSheetUrl, mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowOnboard(!showOnboard)}
            className="gap-2"
          >
            {showOnboard ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showOnboard ? "Cancel" : "Onboard Client"}
          </Button>
          <Button
            onClick={handleGenerateAll}
            disabled={generatingAll}
            className="gap-2"
          >
            {generatingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Key className="h-4 w-4" />
            )}
            {generatingAll ? "Generating..." : "Generate All Tokens"}
          </Button>
        </div>
      </div>

      {/* Onboard form */}
      {showOnboard && (
        <Card>
          <CardHeader>
            <CardTitle>Onboard New Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Workspace Name *
                </label>
                <Input
                  placeholder="e.g. Acme Marketing"
                  value={onboardName}
                  onChange={(e) => setOnboardName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  API Key *
                </label>
                <Input
                  placeholder="e.g. 39|RYHi6oE6..."
                  value={onboardToken}
                  onChange={(e) => setOnboardToken(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Google Sheet URL (optional)
                </label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={onboardSheetUrl}
                  onChange={(e) => setOnboardSheetUrl(e.target.value)}
                />
              </div>
            </div>
            {onboardError && (
              <p className="mt-2 text-sm text-red-500">{onboardError}</p>
            )}
            <Button
              onClick={handleOnboard}
              disabled={onboarding || !onboardName.trim() || !onboardToken.trim()}
              className="mt-4 gap-2"
            >
              {onboarding && <Loader2 className="h-4 w-4 animate-spin" />}
              {onboarding ? "Adding..." : "Add Client"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result banner */}
      {generateResult && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-foreground">
          {generateResult}
          <button
            onClick={() => setGenerateResult(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Name
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("client_status")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>API Token</TableHead>
              <TableHead>Google Sheet</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {search ? "No clients match your search." : "No clients found."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => {
                const isEditing = editingId === client.id;
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                      ) : (
                        client.name
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleStatus(client)}
                        disabled={togglingId === client.id}
                        className="cursor-pointer disabled:opacity-50"
                      >
                        <Badge
                          className={
                            client.client_status === "active"
                              ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25"
                              : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25"
                          }
                        >
                          {togglingId === client.id ? "..." : client.client_status}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editToken}
                          onChange={(e) => setEditToken(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="h-8 text-sm"
                        />
                      ) : (
                        <code className="text-xs text-muted-foreground">
                          {client.api_token_masked}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editSheetUrl}
                          onChange={(e) => setEditSheetUrl(e.target.value)}
                          placeholder="Google Sheet URL"
                          className="h-8 text-sm"
                        />
                      ) : client.google_sheet_url ? (
                        <a
                          href={client.google_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400 text-sm"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1 h-7 px-2">
                              <X className="h-3 w-3" /> Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editName.trim()} className="gap-1 h-7 px-2">
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => startEdit(client)} className="gap-1 h-7 px-2">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {!client.has_api_token && (
                              <Button variant="outline" size="sm" onClick={() => handleGenerateOne(client.id)} disabled={generatingId === client.id} className="gap-1 h-7 px-2">
                                {generatingId === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                                Generate Token
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {clients.length} clients
      </p>
    </div>
  );
}

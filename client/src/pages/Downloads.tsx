import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, Check, X, FileDown, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";

interface FilterState {
  downloadStatus: "all" | "downloaded" | "not_downloaded";
  zipCode: string;
  state: string;
}

interface Account {
  id: number;
  phoneNumber: string;
  memberName: string | null;
  cardNumber: string | null;
  currentBalanceDollars: string | null;
  emailAddress: string | null;
  zipCode: string | null;
  state: string | null;
  downloaded: boolean;
  downloadedAt: string | null;
  createdAt: string;
}

export default function Downloads() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>({
    downloadStatus: "all",
    zipCode: "",
    state: "",
  });
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 50;

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    
    if (filters.downloadStatus !== "all") {
      params.append("downloaded", filters.downloadStatus === "downloaded" ? "true" : "false");
    }
    if (filters.zipCode) {
      params.append("zipCode", filters.zipCode);
    }
    if (filters.state) {
      params.append("state", filters.state);
    }
    
    return params.toString();
  };

  // Fetch list of states
  const { data: statesData } = useQuery({
    queryKey: ["/api/downloads/states"],
    queryFn: async () => {
      const response = await fetch("/api/downloads/states");
      if (!response.ok) throw new Error("Failed to fetch states");
      return response.json();
    },
  });

  // Fetch ZIP to state mapping
  const { data: zipToStateData } = useQuery({
    queryKey: ["/api/downloads/zip-to-state"],
    queryFn: async () => {
      const response = await fetch("/api/downloads/zip-to-state");
      if (!response.ok) throw new Error("Failed to fetch ZIP-to-state mapping");
      return response.json();
    },
  });

  // Fetch accounts with filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/downloads/accounts", filters, page],
    queryFn: async () => {
      const response = await fetch(`/api/downloads/accounts?${buildQueryParams()}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  // Mark accounts as downloaded
  const markAsDownloadedMutation = useMutation({
    mutationFn: async (accountIds: number[]) => {
      return apiRequest("/api/downloads/mark-downloaded", {
        method: "POST",
        body: JSON.stringify({ accountIds }),
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ Éxito",
        description: `${selectedAccounts.size} cuenta(s) marcadas como descargadas`,
      });
      setSelectedAccounts(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/downloads/accounts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Download CSV with automatic marking as downloaded
  const downloadCSV = async () => {
    // Validate that we have accounts to export
    if (selectedAccounts.size === 0) {
      toast({
        title: "❌ Error",
        description: "No hay cuentas para exportar. Selecciona al menos una cuenta.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch ALL selected accounts from backend (not just current page)
      const selectedIds = Array.from(selectedAccounts);
      const response = await fetch("/api/admin/downloads/by-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: selectedIds }),
      });
      
      if (!response.ok) throw new Error("Failed to fetch selected accounts");
      
      const result = await response.json();
      const filteredAccounts = result.accounts;

      if (!filteredAccounts || filteredAccounts.length === 0) {
        toast({
          title: "❌ Error",
          description: "No se pudieron cargar las cuentas seleccionadas",
          variant: "destructive",
        });
        return;
      }

      // STEP 1: Create CSV content with ZIP Code and State columns (use DB data directly)
      const headers = ["Teléfono", "Nombre", "Tarjeta", "Balance", "Código Postal", "Estado", "Email", "Descargada", "Fecha Descarga"];
      const rows = filteredAccounts.map((acc: Account) => {
        return [
          acc.phoneNumber,
          acc.memberName || "",
          acc.cardNumber || "",
          acc.currentBalanceDollars || "0.00",
          acc.zipCode || "",
          acc.state || "", // Use state directly from database
          acc.emailAddress || "", // Use email from database
          "Sí", // Will be marked as downloaded
          new Date().toLocaleDateString(), // Current date as download date
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // STEP 2: Only mark as downloaded if we have valid results
      if (filteredAccounts.length > 0) {
        const accountIds = filteredAccounts.map((acc: Account) => acc.id);
        await apiRequest("/api/downloads/mark-downloaded", {
          method: "POST",
          body: JSON.stringify({ accountIds }),
        });
      }

      // STEP 3: Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `cuentas_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // STEP 4: Show success message and refresh
      toast({
        title: "✅ Descarga completada",
        description: `${filteredAccounts.length} cuenta(s) descargadas y marcadas automáticamente`,
      });

      // Clear selection and refresh data
      setSelectedAccounts(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/downloads/accounts"] });
    } catch (error) {
      toast({
        title: "❌ Error al descargar",
        description: error instanceof Error ? error.message : "Error al generar o descargar el CSV",
        variant: "destructive",
      });
    }
  };

  // Toggle account selection
  const toggleAccount = (id: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  // Select ALL accounts matching the filter (not just current page)
  const toggleSelectAll = async () => {
    if (!data?.accounts) return;
    
    // Check if all accounts on current page are selected
    const allCurrentPageSelected = data.accounts.every((acc: Account) => selectedAccounts.has(acc.id));
    
    if (allCurrentPageSelected && selectedAccounts.size > 0) {
      // Deselect all
      setSelectedAccounts(new Set());
    } else {
      // Select ALL accounts matching filters (not just current page)
      try {
        const params = new URLSearchParams();
        
        if (filters.downloadStatus !== "all") {
          params.append("downloaded", filters.downloadStatus === "downloaded" ? "true" : "false");
        }
        if (filters.zipCode) {
          params.append("zipCode", filters.zipCode);
        }
        if (filters.state) {
          params.append("state", filters.state);
        }
        
        const response = await fetch(`/api/admin/downloads/all-ids?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch all account IDs");
        
        const result = await response.json();
        setSelectedAccounts(new Set(result.accountIds));
        
        toast({
          title: "✅ Todos seleccionados",
          description: `${result.accountIds.length} cuenta(s) seleccionadas`,
        });
      } catch (error) {
        toast({
          title: "❌ Error",
          description: error instanceof Error ? error.message : "Error al seleccionar todas las cuentas",
          variant: "destructive",
        });
      }
    }
  };

  const accounts = data?.accounts || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">Descargas</h1>
          <p className="text-gray-600">Descarga cuentas con filtros personalizados</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtra las cuentas según tus necesidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Download Status */}
            <div className="space-y-2">
              <Label htmlFor="downloadStatus">Estado de Descarga</Label>
              <Select
                value={filters.downloadStatus}
                onValueChange={(value: any) => {
                  setFilters({ ...filters, downloadStatus: value });
                  setPage(1);
                }}
              >
                <SelectTrigger id="downloadStatus" data-testid="select-download-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="downloaded">Ya descargadas</SelectItem>
                  <SelectItem value="not_downloaded">No descargadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zip Code */}
            <div className="space-y-2">
              <Label htmlFor="zipCode">Código Postal</Label>
              <Input
                id="zipCode"
                placeholder="Ej: 33196"
                value={filters.zipCode}
                onChange={(e) => {
                  setFilters({ ...filters, zipCode: e.target.value });
                  setPage(1);
                }}
                data-testid="input-zip-code"
              />
            </div>

            {/* State Filter */}
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Select
                value={filters.state || "all"}
                onValueChange={(value: string) => {
                  setFilters({ ...filters, state: value === "all" ? "" : value });
                  setPage(1);
                }}
              >
                <SelectTrigger id="state" data-testid="select-state">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(statesData?.states || []).map((state: string) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    downloadStatus: "all",
                    zipCode: "",
                    state: "",
                  });
                  setPage(1);
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {total} cuenta(s) encontrada(s) | {selectedAccounts.size} seleccionada(s)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={downloadCSV}
                disabled={selectedAccounts.size === 0}
                data-testid="button-download-csv"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Descargar CSV ({selectedAccounts.size})
              </Button>
              <Button
                onClick={() => markAsDownloadedMutation.mutate(Array.from(selectedAccounts))}
                disabled={selectedAccounts.size === 0}
                variant="outline"
                data-testid="button-mark-downloaded"
              >
                <Check className="w-4 h-4 mr-2" />
                Marcar como Descargadas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron cuentas con los filtros aplicados
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={accounts.length > 0 && accounts.every((acc: Account) => selectedAccounts.has(acc.id))}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Código Postal</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Estado de Descarga</TableHead>
                      <TableHead>Fecha Descarga</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account: Account) => (
                      <TableRow key={account.id} data-testid={`row-account-${account.phoneNumber}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAccounts.has(account.id)}
                            onCheckedChange={() => toggleAccount(account.id)}
                            data-testid={`checkbox-account-${account.phoneNumber}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{account.phoneNumber}</TableCell>
                        <TableCell>{account.memberName || "-"}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-600">
                            ${account.currentBalanceDollars || "0.00"}
                          </span>
                        </TableCell>
                        <TableCell>{account.zipCode || "-"}</TableCell>
                        <TableCell>
                          {(() => {
                            const zipCode = account.zipCode || "";
                            const cleanZip = zipCode.split('-')[0];
                            const zipToState = zipToStateData?.zipToState || {};
                            return zipToState[cleanZip] || "-";
                          })()}
                        </TableCell>
                        <TableCell>
                          {account.downloaded ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              <Download className="w-3 h-3 mr-1" />
                              Descargada
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {account.downloadedAt 
                            ? new Date(account.downloadedAt).toLocaleDateString() 
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <Button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      variant="outline"
                      size="sm"
                      data-testid="button-next-page"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

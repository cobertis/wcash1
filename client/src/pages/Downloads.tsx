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
  minBalance: string;
  dateFrom: string;
  dateTo: string;
}

interface Account {
  id: number;
  phoneNumber: string;
  memberName: string | null;
  cardNumber: string | null;
  currentBalanceDollars: string | null;
  zipCode: string | null;
  downloaded: boolean;
  downloadedAt: string | null;
  createdAt: string;
}

export default function Downloads() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>({
    downloadStatus: "all",
    zipCode: "",
    minBalance: "",
    dateFrom: "",
    dateTo: "",
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
    if (filters.minBalance) {
      params.append("minBalance", filters.minBalance);
    }
    if (filters.dateFrom) {
      params.append("dateFrom", filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append("dateTo", filters.dateTo);
    }
    
    return params.toString();
  };

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

  // Download CSV
  const downloadCSV = () => {
    const accountsToDownload = data?.accounts.filter((acc: Account) => 
      selectedAccounts.has(acc.id)
    ) || [];

    if (accountsToDownload.length === 0) {
      toast({
        title: "⚠️ Advertencia",
        description: "Selecciona al menos una cuenta para descargar",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["Teléfono", "Nombre", "Tarjeta", "Balance", "Código Postal", "Email", "Descargada", "Fecha Descarga"];
    const rows = accountsToDownload.map((acc: Account) => [
      acc.phoneNumber,
      acc.memberName || "",
      acc.cardNumber || "",
      acc.currentBalanceDollars || "0.00",
      acc.zipCode || "",
      "", // Email could be added if available
      acc.downloaded ? "Sí" : "No",
      acc.downloadedAt ? new Date(acc.downloadedAt).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cuentas_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "✅ Descarga completada",
      description: `${accountsToDownload.length} cuenta(s) descargadas`,
    });
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

  // Select all accounts on current page
  const toggleSelectAll = () => {
    if (!data?.accounts) return;
    
    const allSelected = data.accounts.every((acc: Account) => selectedAccounts.has(acc.id));
    if (allSelected) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(data.accounts.map((acc: Account) => acc.id)));
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

            {/* Min Balance */}
            <div className="space-y-2">
              <Label htmlFor="minBalance">Balance Mínimo ($)</Label>
              <Input
                id="minBalance"
                type="number"
                step="0.01"
                placeholder="Ej: 10.00"
                value={filters.minBalance}
                onChange={(e) => {
                  setFilters({ ...filters, minBalance: e.target.value });
                  setPage(1);
                }}
                data-testid="input-min-balance"
              />
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilters({ ...filters, dateFrom: e.target.value });
                  setPage(1);
                }}
                data-testid="input-date-from"
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilters({ ...filters, dateTo: e.target.value });
                  setPage(1);
                }}
                data-testid="input-date-to"
              />
            </div>

            {/* Clear Filters */}
            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    downloadStatus: "all",
                    zipCode: "",
                    minBalance: "",
                    dateFrom: "",
                    dateTo: "",
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

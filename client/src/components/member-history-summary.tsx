import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DollarSign, Activity, AlertTriangle } from "lucide-react";


export function MemberHistorySummary() {
  const [selectedTab, setSelectedTab] = useState("summary");
  // Toast removed
  
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["/api/member-history/summary"],
    // Removed inefficient 5-second polling - now uses WebSocket updates only
  });

  // WebSocket connection for real-time updates ONLY when data changes
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('📡 WebSocket connected for real-time statistics');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Only update when there are REAL changes
            if (data.type === 'member_added' || data.type === 'stats_update' || data.type === 'scanner_started' || data.type === 'scanner_stopped') {
              console.log('📊 Real-time update received:', data);
              
              // Invalidate cache to fetch fresh data ONLY when needed
              queryClient.invalidateQueries({ queryKey: ["/api/member-history/summary"] });
              
              // Show toast notification for new member found
              if (data.type === 'member_added') {
                console.log(`Toast removed: Nueva cuenta encontrada - ${data.message}`);
              }
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, attempting reconnect...');
          setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setTimeout(connectWebSocket, 5000); // Retry after 5 seconds
      }
    };

    connectWebSocket();

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const { data: validMembers, isLoading: validLoading } = useQuery({
    queryKey: ["/api/member-history/detailed", { filter: "valid", page: 1, size: 50 }],
    enabled: selectedTab === "valid",
  });

  const { data: invalidMembers, isLoading: invalidLoading } = useQuery({
    queryKey: ["/api/member-history/detailed", { filter: "invalid", page: 1, size: 50 }],
    enabled: selectedTab === "invalid",
  });

  const { data: balanceMembers, isLoading: balanceLoading } = useQuery({
    queryKey: ["/api/member-history/detailed", { filter: "withBalance", page: 1, size: 50 }],
    enabled: selectedTab === "balance",
  });

  if (summaryLoading) {
    return <div className="animate-pulse">Cargando resumen...</div>;
  }

  if (!summary) {
    return <div className="text-gray-500">No hay datos disponibles</div>;
  }

  // Type-safe access to summary properties
  const summaryData = summary as any;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{summaryData?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Válidas</p>
                <p className="text-2xl font-bold text-green-600">{summaryData?.valid || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Inválidas</p>
                <p className="text-2xl font-bold text-red-600">{summaryData?.invalid || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Con Balance</p>
                <p className="text-2xl font-bold text-yellow-600">{summaryData?.withBalance || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed view */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="valid">Válidas ({summaryData?.valid || 0})</TabsTrigger>
          <TabsTrigger value="invalid">Inválidas ({summaryData?.invalid || 0})</TabsTrigger>
          <TabsTrigger value="balance">Con Balance ({summaryData?.withBalance || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balance Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  ${typeof summaryData?.totalBalance === 'number' ? summaryData.totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                </p>
                <p className="text-sm text-gray-600">
                  En {summaryData?.withBalance || 0} cuentas con balance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actividad Reciente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{summaryData?.recentActivity || 0}</p>
                <p className="text-sm text-gray-600">
                  Cuentas activas en últimos 30 días
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Cuentas con Mayor Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(summaryData?.topBalances || []).map((member: any, index: number) => (
                  <div key={`top-${member.phoneNumber}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{member.memberName}</p>
                        <p className="text-sm text-gray-600">{member.phoneNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${member.currentBalanceDollars}</p>
                      <p className="text-xs text-gray-500">
                        {member.lastActivityDate ? new Date(member.lastActivityDate).toLocaleDateString() : 'Sin actividad'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas Válidas</CardTitle>
              <CardDescription>
                Cuentas que fueron encontradas y verificadas exitosamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validLoading ? (
                <div className="animate-pulse">Cargando cuentas válidas...</div>
              ) : (validMembers as any)?.data ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {((validMembers as any).data || []).map((member: any, index: number) => (
                    <div key={`valid-${member.phoneNumber}-${member.id || index}`} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                      <div>
                        <p className="font-medium">{member.memberName}</p>
                        <p className="text-sm text-gray-600">{member.phoneNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${member.currentBalanceDollars}</p>
                        <p className="text-xs text-gray-500">
                          {member.lastActivityDate ? new Date(member.lastActivityDate).toLocaleDateString() : 'Sin actividad'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay cuentas válidas</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invalid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas Inválidas</CardTitle>
              <CardDescription>
                Números de teléfono que no tienen cuenta de Walgreens o no pudieron ser verificados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invalidLoading ? (
                <div className="animate-pulse">Cargando cuentas inválidas...</div>
              ) : (invalidMembers as any)?.data ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {((invalidMembers as any).data || []).map((member: any, index: number) => (
                    <div key={`invalid-${member.phoneNumber}-${member.id || index}`} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                      <div>
                        <p className="font-medium text-red-600">{member.phoneNumber}</p>
                        <p className="text-sm text-gray-600">Cuenta no encontrada</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">Inválida</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay cuentas inválidas</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas con Balance</CardTitle>
              <CardDescription>
                Cuentas que tienen W Cash rewards disponibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <div className="animate-pulse">Cargando cuentas con balance...</div>
              ) : (balanceMembers as any)?.data ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {((balanceMembers as any).data || []).map((member: any, index: number) => (
                    <div key={`balance-${member.phoneNumber}-${member.id || index}`} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                      <div>
                        <p className="font-medium">{member.memberName}</p>
                        <p className="text-sm text-gray-600">{member.phoneNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-600">${member.currentBalanceDollars}</p>
                        <p className="text-xs text-gray-500">
                          {member.lastActivityDate ? new Date(member.lastActivityDate).toLocaleDateString() : 'Sin actividad'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay cuentas con balance</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
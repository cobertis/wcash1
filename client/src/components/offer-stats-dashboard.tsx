import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Gift, Star, DollarSign } from 'lucide-react';

interface OfferStats {
  totalSavings: number;
  clippedCount: number;
  redeemedCount: number;
  availableCount: number;
  popularCategories: Array<{
    category: string;
    count: number;
    avgSavings: number;
  }>;
}

interface OfferStatsDashboardProps {
  encLoyaltyId: string;
}

export default function OfferStatsDashboard({ encLoyaltyId }: OfferStatsDashboardProps) {
  const { data: stats, isLoading, error } = useQuery<OfferStats>({
    queryKey: ['offer-stats', encLoyaltyId],
    queryFn: async () => {
      const response = await fetch(`/api/offers/stats/${encodeURIComponent(encLoyaltyId)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch offer statistics');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar las estadísticas de ofertas
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const savingsRate = stats.redeemedCount > 0 ? (stats.totalSavings / stats.redeemedCount).toFixed(2) : '0.00';
  const redemptionRate = stats.clippedCount > 0 ? Math.round((stats.redeemedCount / stats.clippedCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ahorros Totales
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.totalSavings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: ${savingsRate} por oferta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ofertas Recortadas
            </CardTitle>
            <Gift className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.clippedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Disponibles: {stats.availableCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ofertas Canjeadas
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.redeemedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Tasa de canje: {redemptionRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ofertas Disponibles
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.availableCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Nuevas ofertas disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categorías Populares</TabsTrigger>
          <TabsTrigger value="progress">Progreso</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Categorías Más Populares</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.popularCategories.map((category, index) => (
                  <div key={category.category} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{category.category}</span>
                        <Badge variant="secondary">{category.count} ofertas</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Promedio de ahorros: ${category.avgSavings.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Tasa de Canje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Recortadas</span>
                    <span className="text-sm font-medium">{stats.clippedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Canjeadas</span>
                    <span className="text-sm font-medium">{stats.redeemedCount}</span>
                  </div>
                  <Progress value={redemptionRate} className="w-full" />
                  <div className="text-center text-sm text-muted-foreground">
                    {redemptionRate}% de tasa de canje
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actividad de Ofertas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Disponibles: {stats.availableCount}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Gift className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Recortadas: {stats.clippedCount}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Canjeadas: {stats.redeemedCount}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Ahorros: ${stats.totalSavings.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
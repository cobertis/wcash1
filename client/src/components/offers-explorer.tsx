import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Search, Bookmark, CheckCircle, ChevronLeft, ChevronRight, BarChart3, Filter, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import OfferCard from "./offer-card";
import OfferStatsDashboard from "./offer-stats-dashboard";
import AdvancedOfferFilters from "./advanced-offer-filters";
import type { FilterOptions } from "@/lib/api";

interface OffersExplorerProps {
  encLoyaltyId: string;
}

export default function OffersExplorer({ encLoyaltyId }: OffersExplorerProps) {
  const [activeTab, setActiveTab] = useState("top");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  
  // Toast removed - using console.log instead
  const queryClient = useQueryClient();

  // Category Counts Query
  const { data: categoryCounts } = useQuery({
    queryKey: ["/api/category-counts", encLoyaltyId],
    queryFn: async () => {
      return api.getCategoryCounts(encLoyaltyId);
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Top Offers Query
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ["/api/offers", encLoyaltyId, currentPage, category, activeTab],
    queryFn: async () => {
      return api.fetchOffers(encLoyaltyId, currentPage, 15, category === "all" ? undefined : category);
    },
    enabled: activeTab === "top",
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Search Query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["/api/search", encLoyaltyId, searchQuery, searchType, currentPage, activeTab],
    queryFn: async () => {
      return api.searchOffers(encLoyaltyId, searchQuery, searchType, currentPage, 15);
    },
    enabled: activeTab === "search" && searchQuery.length > 0,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Clipped Offers Query
  const { data: clippedData, isLoading: clippedLoading } = useQuery({
    queryKey: ["/api/clipped", encLoyaltyId, activeTab],
    queryFn: async () => {
      return api.getClippedOffers(encLoyaltyId, 1, 500); // Get all offers at once (500 max)
    },
    enabled: activeTab === "clips",
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Redeemed Offers Query
  const { data: redeemedData, isLoading: redeemedLoading } = useQuery({
    queryKey: ["/api/redeemed", encLoyaltyId, startDate, endDate, currentPage, activeTab],
    queryFn: async () => {
      return api.getRedeemedOffers(encLoyaltyId, startDate, endDate, currentPage, 15);
    },
    enabled: activeTab === "redeemed",
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Filtered Offers Query
  const { data: filteredData, isLoading: filteredLoading } = useQuery({
    queryKey: ["/api/offers/filtered", encLoyaltyId, filters, currentPage, activeTab],
    queryFn: async () => {
      return api.getFilteredOffers(encLoyaltyId, filters, currentPage, 15);
    },
    enabled: activeTab === "filtered",
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Clip All Offers Mutation
  const clipAllMutation = useMutation({
    mutationFn: async () => {
      console.log("🚀 Starting clipAllOffers mutation with encLoyaltyId:", encLoyaltyId);
      const result = await api.clipAllOffers(encLoyaltyId);
      console.log("📊 clipAllOffers result:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("✅ clipAllOffers success:", data);
console.log("Toast removed");
      
      // Clear all cached data immediately
      queryClient.clear();
      
      // Force immediate refresh of clipped offers data multiple times
      const refreshClippedOffers = async () => {
        try {
          console.log("🔄 Refreshing clipped offers data...");
          const response = await fetch(`/api/clipped?encLoyaltyId=${encodeURIComponent(encLoyaltyId)}&page=1&size=500`);
          if (response.ok) {
            const freshData = await response.json();
            console.log("✅ Fresh clipped offers data received:", freshData);
            queryClient.setQueryData(["/api/clipped", encLoyaltyId, 1, activeTab], freshData);
            queryClient.invalidateQueries({ queryKey: ["/api/clipped"] });
          }
        } catch (error) {
          console.error('Error refreshing clipped offers:', error);
        }
      };
      
      // Refresh immediately, then again after 2 seconds, then after 5 seconds
      refreshClippedOffers();
      setTimeout(refreshClippedOffers, 2000);
      setTimeout(refreshClippedOffers, 5000);
      
      // Switch to My Clips tab to show the results
      setTimeout(() => {
        setActiveTab("clips");
      }, 1000);
    },
    onError: (error) => {
      console.error("❌ clipAllOffers error:", error);
console.log("Toast removed");
    },
  });

  const tabs = [
    { id: "top", label: "Top Offers", icon: Star },
    { id: "search", label: "Search", icon: Search },
    { id: "clips", label: "My Clips", icon: Bookmark },
    { id: "redeemed", label: "Redeemed", icon: CheckCircle },
    { id: "stats", label: "Statistics", icon: BarChart3 },
    { id: "filtered", label: "Filtered", icon: Filter },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  // Real-time search effect
  useEffect(() => {
    if (activeTab === "search" && searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
      }, 300); // Debounce search for 300ms
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, activeTab]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case "top":
        return offersData;
      case "search":
        return searchData;
      case "clips":
        return clippedData;
      case "redeemed":
        return redeemedData;
      case "filtered":
        return filteredData;
      default:
        return null;
    }
  };

  const handleApplyFilters = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
    
    // Check if any meaningful filters are applied
    const hasActiveFilters = Boolean(
      newFilters.category || 
      newFilters.brand || 
      newFilters.expiringBefore ||
      (newFilters.minValue && newFilters.minValue > 0) ||
      (newFilters.maxValue && newFilters.maxValue < 50) ||
      (newFilters.sortBy && newFilters.sortBy !== 'value') ||
      (newFilters.sortOrder && newFilters.sortOrder !== 'desc')
    );
    
    if (hasActiveFilters) {
      setActiveTab("filtered");
    } else {
      setActiveTab("top");
    }
  };

  const renderPagination = () => {
    const currentData = getCurrentData();
    let totalCount = 0;
    
    // Get total count based on active tab
    switch (activeTab) {
      case "top":
        totalCount = offersData?.totalCount || 0;
        break;
      case "search":
        totalCount = searchData?.totalCount || 0;
        break;
      case "clips":
        totalCount = clippedData?.totalCount || clippedData?.clippedOffers?.length || 0;
        break;
      case "redeemed":
        totalCount = redeemedData?.totalCount || redeemedData?.redeemedOffers?.length || 0;
        break;
      case "filtered":
        totalCount = filteredData?.totalCount || 0;
        break;
      default:
        totalCount = 0;
    }
    
    const pageSize = 15;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <Button
            key={i}
            variant={currentPage === i ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(i)}
            className="min-w-[40px]"
          >
            {i}
          </Button>
        );
      }

      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-8 space-y-4 sm:space-y-0">
        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
          Mostrando {((currentPage - 1) * pageSize + 1)} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount} ofertas
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="text-xs"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          
          {renderPageNumbers()}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="text-xs"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  const renderOffers = () => {
    let data, loading;
    
    switch (activeTab) {
      case "top":
        data = offersData?.offers || [];
        loading = offersLoading;
        break;
      case "search":
        data = searchData?.offers || [];
        loading = searchLoading;
        break;
      case "clips":
        data = clippedData?.clippedOffers || [];
        loading = clippedLoading;
        break;
      case "redeemed":
        data = redeemedData?.redeemedOffers || [];
        loading = redeemedLoading;
        break;
      default:
        data = [];
        loading = false;
    }

    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <Skeleton className="h-32 w-full" />
                <div className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-3" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      const totalCount = activeTab === "top" ? offersData?.totalCount || 0 : 0;
      return (
        <div className="text-center py-12">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-8 max-w-md mx-auto">
            <div className="text-blue-600 dark:text-blue-400 text-2xl mb-4">
              {activeTab === "search" ? "🔍" : activeTab === "clips" ? "📑" : activeTab === "redeemed" ? "✅" : "🎯"}
            </div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {activeTab === "search" && "No se encontraron ofertas"}
              {activeTab === "clips" && "No tienes ofertas guardadas"}
              {activeTab === "redeemed" && "No hay ofertas canjeadas"}
              {activeTab === "top" && "No hay ofertas disponibles"}
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              {activeTab === "search" && "Intenta con diferentes términos de búsqueda"}
              {activeTab === "clips" && "Guarda ofertas para verlas aquí"}
              {activeTab === "redeemed" && "Las ofertas canjeadas aparecerán aquí"}
              {activeTab === "top" && totalCount > 0 && `La API indica que hay ${totalCount} ofertas disponibles en total, pero no hay cupones disponibles para recortar en este momento. Intenta más tarde.`}
              {activeTab === "top" && totalCount === 0 && "No hay ofertas disponibles en este momento"}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Total Count Display for Clipped Offers */}
        {activeTab === "clips" && clippedData?.totalCount && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="text-green-600 dark:text-green-400">📑</div>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Total ofertas clipped: <span className="font-bold">{clippedData.totalCount}</span>
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Mostrando TODAS las {data.length} ofertas clipped
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((offer: any) => (
            <OfferCard 
              key={offer.offerId} 
              offer={offer} 
              encLoyaltyId={encLoyaltyId}
              variant={activeTab}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Tab Navigation */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-2 px-2 sm:space-x-8 sm:px-6 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex items-center ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <Card>
        <CardContent className="p-6">
          {/* Top Offers Tab */}
          {activeTab === "top" && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-900">Featured Offers</h3>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button 
                    onClick={() => clipAllMutation.mutate()}
                    disabled={clipAllMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg text-sm px-3 py-2 h-9"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {clipAllMutation.isPending ? "Procesando..." : "Clip Todas las Ofertas"}
                  </Button>
                  <Label htmlFor="category" className="text-sm text-gray-600">Category:</Label>
                  <Select value={category} onValueChange={(value) => {
                    setCategory(value);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All Categories
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.reduce((sum, cat) => sum + cat.count, 0)})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Personal Care">
                        Personal Care
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Personal Care")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Medicines & Treatments">
                        Medicines & Treatments
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Medicines & Treatments")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Household">
                        Household
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Household")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Beauty">
                        Beauty
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Beauty")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Grocery">
                        Grocery
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Grocery")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Baby, Kids & Toys">
                        Baby, Kids & Toys
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Baby, Kids & Toys")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Vitamins & Supplements">
                        Vitamins & Supplements
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Vitamins & Supplements")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Sexual Wellness">
                        Sexual Wellness
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Sexual Wellness")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                      <SelectItem value="Home Medical">
                        Home Medical
                        {categoryCounts && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({categoryCounts.find(cat => cat.category === "Home Medical")?.count || 0})
                          </span>
                        )}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderOffers()}
            </>
          )}

          {/* Search Tab */}
          {activeTab === "search" && (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Offers</h3>
              <form onSubmit={handleSearch} className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for offers, products, or brands..."
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={searchType} onValueChange={setSearchType}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="coupon">Coupons</SelectItem>
                        <SelectItem value="deal">Deals</SelectItem>
                        <SelectItem value="reward">Rewards</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" className="px-4">
                      <Search className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Search</span>
                    </Button>
                  </div>
                </div>
              </form>
              {renderOffers()}
            </>
          )}

          {/* My Clips Tab */}
          {activeTab === "clips" && (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                My Clipped Offers
                {clippedData && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({clippedData.clippedOffers?.length || 0} cupones clipados)
                  </span>
                )}
              </h3>
              {renderOffers()}
            </>
          )}

          {/* Redeemed Tab */}
          {activeTab === "redeemed" && (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Redeemed Offers</h3>
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</Label>
                    <Input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</Label>
                    <Input
                      type="date"
                      id="endDate"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button onClick={() => setCurrentPage(1)} className="w-full sm:w-auto">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                    </svg>
                    Filter
                  </Button>
                </div>
              </div>
              {renderOffers()}
            </>
          )}

          {/* Statistics Tab */}
          {activeTab === "stats" && (
            <OfferStatsDashboard encLoyaltyId={encLoyaltyId} />
          )}

          {/* Filtered Tab */}
          {activeTab === "filtered" && (
            <div className="space-y-6">
              <AdvancedOfferFilters 
                onApplyFilters={handleApplyFilters} 
                isLoading={filteredLoading}
              />
              {Object.keys(filters).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ofertas Filtradas</h3>
                  {renderOffers()}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {renderPagination()}
        </CardContent>
      </Card>
    </div>
  );
}

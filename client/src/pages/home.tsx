import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import MemberLookup from "@/components/member-lookup";
import LoadingOverlay from "@/components/loading-overlay";

export default function Home() {
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLookupSuccess = (encId: string, profile: any, lookupResponse: any) => {
    // Store data in sessionStorage for the dashboard
    sessionStorage.setItem('walgreens_lookup_data', JSON.stringify({
      encLoyaltyId: encId,
      lookupData: lookupResponse,
      memberData: profile
    }));
    
    // Also store in memberData format for products-through-offers
    sessionStorage.setItem('memberData', JSON.stringify({
      encLoyaltyId: encId,
      profile: profile,
      lookupData: lookupResponse
    }));
    
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('memberDataUpdated'));
    
    // Navigate to dashboard
    navigate('/dashboard/overview');
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">
              Walgreens
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {" "}Offers Explorer
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 px-4">
              Busca información detallada de miembros por número de teléfono
            </p>
          </div>
          
          <Card className="shadow-2xl border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                Buscar Miembro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              <MemberLookup
                onSuccess={handleLookupSuccess}
                onLoadingChange={setLoading}
              />
            </CardContent>
          </Card>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-gray-500 text-sm px-4">
              Ingresa un número de teléfono para acceder al dashboard completo con información detallada del miembro
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import MemberLookup from "@/components/member-lookup";
import LoadingOverlay from "@/components/loading-overlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const params = useParams();
  const [lookupData, setLookupData] = useState<any>(null);
  const [memberData, setMemberData] = useState<any>(null);
  const [encLoyaltyId, setEncLoyaltyId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load data from sessionStorage on component mount
  useEffect(() => {
    // Try new sessionStorage format first
    const newMemberData = sessionStorage.getItem('memberData');
    const newMemberPhone = sessionStorage.getItem('memberPhone');
    
    if (newMemberData && newMemberPhone) {
      try {
        const parsedData = JSON.parse(newMemberData);
        console.log('🔴 PARSED MEMBER DATA:', parsedData);
        console.log('🔴 RAW LOOKUP DATA:', parsedData.rawLookupData);
        console.log('🔴 RAW MEMBER DATA:', parsedData.rawMemberData);
        
        // Set the rawMemberData as memberData and lookupData as profile
        setLookupData(parsedData.rawLookupData || parsedData);
        setMemberData(parsedData.rawMemberData || parsedData);
        setEncLoyaltyId(parsedData.encLoyaltyId || '');
        
        console.log('🔴 SET lookupData:', parsedData.rawLookupData || parsedData);
        console.log('🔴 SET memberData:', parsedData.rawMemberData || parsedData);
        
        // Also store in the old format for dashboard-layout compatibility
        sessionStorage.setItem('walgreens_lookup_data', JSON.stringify({
          encLoyaltyId: parsedData.encLoyaltyId || '',
          lookupData: parsedData.rawLookupData || parsedData,
          memberData: parsedData.rawMemberData || parsedData
        }));
      } catch (error) {
        console.error('Error parsing new sessionStorage data:', error);
      }
    } else {
      // Fallback to old format
      const storedData = sessionStorage.getItem('walgreens_lookup_data');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setLookupData(parsedData.lookupData);
          setMemberData(parsedData.memberData);
          setEncLoyaltyId(parsedData.encLoyaltyId);
        } catch (error) {
          console.error('Error parsing old sessionStorage data:', error);
        }
      }
    }
  }, []);

  // Check if we have member data - lookupData can be null/undefined, that's ok
  const hasMemberData = memberData || encLoyaltyId;
  
  // Remove debug logs for production
  // console.log('Dashboard state check:', { hasMemberData, lookupData: !!lookupData, memberData: !!memberData, encLoyaltyId: !!encLoyaltyId, actualEncId: encLoyaltyId });

  const handleLookupSuccess = (encId: string, memberData: any, lookupData: any) => {
    setEncLoyaltyId(encId);
    setLookupData(lookupData);
    setMemberData(memberData);
    
    // Store data in sessionStorage
    sessionStorage.setItem('walgreens_lookup_data', JSON.stringify({
      encLoyaltyId: encId,
      lookupData: lookupData,
      memberData: memberData
    }));
    
    // Navigate to member overview after successful lookup
    const phoneNumber = sessionStorage.getItem('memberPhone') || 'unknown';
    navigate(`/member/${phoneNumber}/overview`);
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  // If no member data, redirect to control panel
  if (!hasMemberData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                Walgreens Offers Explorer
              </h1>
              <p className="text-lg text-gray-600">
                Busca información detallada de miembros y explora ofertas disponibles
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Panel de Control
                </Button>
              </div>
            </div>
            
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Buscar Miembro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MemberLookup
                  onSuccess={handleLookupSuccess}
                  onLoadingChange={setLoading}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      lookupData={lookupData}
      memberData={memberData}
      encLoyaltyId={encLoyaltyId}
    />
  );
}
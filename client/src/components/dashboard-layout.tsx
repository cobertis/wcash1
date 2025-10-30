import { useState, useEffect } from "react";
import { User, CreditCard, Gift, Settings, Phone, Mail, Calendar, DollarSign, Award, ShoppingCart, Menu, X, Home, MapPin, Package, Search, Brain, BarChart3, Users, Database, Zap, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Link } from "wouter";
import OffersExplorer from "./offers-explorer";
import StoreLocator from "./store-locator";
import StoreInventory from "./store-inventory";
import ProductSearch from "./product-search";

interface DashboardLayoutProps {
  lookupData: any;
  memberData: any;
  encLoyaltyId: string;
}

interface MenuSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export default function DashboardLayout({ lookupData, memberData, encLoyaltyId }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const [sessionData, setSessionData] = useState(null);
  const [markedAccounts, setMarkedAccounts] = useState(new Set<string>());
  const [markingMember, setMarkingMember] = useState<string | null>(null);
  
  // Get member data from sessionStorage for store assignment info
  const storedLookupData = sessionStorage.getItem('walgreens_lookup_data');
  const lookupDataStored = storedLookupData ? JSON.parse(storedLookupData) : null;
  const sessionMemberData = (sessionData as any)?.memberData || lookupDataStored?.memberData || null;

  // Get phone number from URL for marking functionality
  const urlParts = location.split('/');
  const currentPhoneNumber = urlParts[1] === 'admin' && urlParts[2] === 'member' 
    ? urlParts[3] 
    : urlParts[2];

  // Handle marking account as used with API refresh and move to end
  const handleMarkAsUsed = async (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    setMarkingMember(phoneNumber);
    try {
      // 1. First call live API to refresh account data
      console.log('🔄 Refreshing account data from live API for:', phoneNumber);
      const refreshResponse = await fetch('/api/lookup-live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        console.log('✅ Account data refreshed from API:', refreshedData.profile?.Name?.FirstName);
      }

      // 2. Mark as used and move to end of pages
      const markResponse = await fetch('/api/member-history/mark-used', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber,
          refreshedFromAPI: true,
          moveToEnd: true 
        }),
      });

      if (markResponse.ok) {
        const markResult = await markResponse.json();
        console.log('✅ Mark as used response:', markResult);
        
        setMarkedAccounts(prev => new Set(prev).add(phoneNumber));
        console.log('✅ Account marked as used and moved to end:', phoneNumber);
        
        // 3. Trigger refresh of parent components (if in control panel view)
        if (window.location.pathname.includes('/admin')) {
          // Dispatch event to refresh account lists
          window.dispatchEvent(new CustomEvent('accountMarkedAsUsed', { 
            detail: { phoneNumber } 
          }));
        }
      } else {
        const errorData = await markResponse.json();
        console.error('❌ Failed to mark account as used:', errorData);
        throw new Error(`Failed to mark account: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error marking account as used:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        phoneNumber
      });
      
      // Show error message to user
      alert(`Error al marcar cuenta como usada: ${error.message || 'Error desconocido'}`);
    } finally {
      setMarkingMember(null);
    }
  };
  

  
  // Listen for sessionStorage changes to update the dashboard
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedData = sessionStorage.getItem('walgreens_lookup_data');
      setSessionData(updatedData ? JSON.parse(updatedData) : null);
    };
    
    // Listen for storage events
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events when sessionStorage is updated from the same tab
    window.addEventListener('sessionStorageUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionStorageUpdated', handleStorageChange);
    };
  }, []);

  // Load marked accounts status on component mount
  useEffect(() => {
    const loadMarkedStatus = async () => {
      if (!currentPhoneNumber) return;
      
      try {
        const response = await fetch(`/api/member-history/${currentPhoneNumber}`);
        if (response.ok) {
          const memberData = await response.json();
          if (memberData?.markedAsUsed) {
            setMarkedAccounts(prev => new Set(prev).add(currentPhoneNumber));
          }
        }
      } catch (error) {
        console.error('Error loading marked status:', error);
      }
    };

    loadMarkedStatus();
  }, [currentPhoneNumber]);

  // Optimized: Remove auto-loading that causes delays
  // Dashboard will load sidebar counts on demand via React Query
  

  
  // Extract section from URL - handle both /admin/member/phone/section and /member/phone/section
  // urlParts already declared above for currentPhoneNumber
  const activeSection = urlParts.length > 4 && urlParts[1] === 'admin' && urlParts[2] === 'member' 
    ? urlParts[4] || 'overview'  // /admin/member/phone/section
    : urlParts[3] || 'overview'; // /member/phone/section (fallback)
  
  // Listen for toggle-sidebar event from universal header
  useEffect(() => {
    const handleToggleSidebar = () => {
      console.log('🎯 DASHBOARD-LAYOUT: Toggle sidebar event received, current state:', sidebarOpen);
      setSidebarOpen(prev => {
        console.log('🎯 DASHBOARD-LAYOUT: Changing sidebar state from', prev, 'to', !prev);
        return !prev;
      });
    };
    
    console.log('🎯 DASHBOARD-LAYOUT: Adding event listener for toggle-sidebar');
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => {
      console.log('🎯 DASHBOARD-LAYOUT: Removing event listener for toggle-sidebar');
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, [sidebarOpen]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      const menuButton = document.getElementById('menu-button');
      
      if (sidebarOpen && sidebar && menuButton && 
          !sidebar.contains(event.target as Node) && 
          !menuButton.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // Extract data from the correct structure
  console.log('🔥 DASHBOARD RECEIVED DATA:', { lookupData, memberData });
  // console.log('🔥 DASHBOARD - selectedMember:', selectedMember);
  
  const rawLookupData = lookupData || {};
  const rawMemberData = memberData || {};
  const profile = rawMemberData || {};
  const matchProfile = rawLookupData.profile?.matchProfiles?.[0] || rawLookupData.matchProfiles?.[0] || {};
  
  console.log('🔴 DASHBOARD - EXTRACTED:', { 
    profile: !!profile, 
    cardNumber: profile.CardNumber,
    matchProfile: !!matchProfile,
    zipCode: matchProfile?.zipCode,
    lastActivity: profile.Reward?.LastActivityDate,
    currentBalance: profile.Reward?.CurrentBalance
  });

  
  const programPrefList = profile.ProgramPrefList?.Preference || [];
  const programList = profile.ProgramPrefList?.Preference || []; // Los programas reales están en ProgramPrefList
  const rawProgramList = profile.ProgramList?.Program || []; // Programas básicos
  const rewardData = profile.Reward || {};
  const preferences = profile.Preferences || {};
  const phoneList = profile.PhoneList?.Phone || [];
  const pointsExpirations = profile.PointsExpirations || [];
  const affiliationPoints = profile.AffiliationPoints || [];

  // Debug - verificar datos importantes
  console.log('🔍 Dashboard data mapping:', {
    profileExists: !!profile,
    rewardExists: !!rewardData,
    programListLength: programList.length,
    rawProgramListLength: rawProgramList.length,
    phoneListLength: phoneList.length,
    pointsExpirationsLength: pointsExpirations.length,
    currentBalance: rewardData.CurrentBalance,
    currentBalanceDollars: rewardData.CurrentBalanceDollars,
    memberID: profile.MemberID,
    cardNumber: profile.CardNumber,
    loyaltyCardNumber: matchProfile?.loyaltyCardNumber,
    memberName: profile.Name?.FirstName + ' ' + profile.Name?.LastName,
    zipCode: matchProfile?.zipCode || rawLookupData?.matchProfiles?.[0]?.zipCode,
    lastActivityDate: rewardData.LastActivityDate,
    profileName: profile.Name,
    matchProfileData: matchProfile,
    rawLookupData: rawLookupData.matchProfiles
  });

  const menuSections: MenuSection[] = [
    { id: "overview", label: "Resumen", icon: <Home className="w-5 h-5" /> },
    { id: "rewards", label: "Recompensas", icon: <DollarSign className="w-5 h-5" /> },
    { id: "programs", label: "Programas", icon: <Award className="w-5 h-5" />, count: programList.length || rawProgramList.length },
    { id: "offers", label: "Ofertas", icon: <Gift className="w-5 h-5" /> },
    { id: "stores", label: "Tiendas", icon: <MapPin className="w-5 h-5" /> },
    { id: "products", label: "Productos", icon: <Search className="w-5 h-5" /> },
    { id: "preferences", label: "Preferencias", icon: <Settings className="w-5 h-5" /> },
    { id: "raw", label: "Datos Raw", icon: <ShoppingCart className="w-5 h-5" /> },
  ];

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return phone;
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
                <div className="ml-2 sm:ml-3 min-w-0">
                  <p className="text-xs font-medium text-gray-600">Miembro</p>
                  <p className="text-sm sm:text-base font-bold leading-tight truncate">{profile.Name?.FirstName || matchProfile.firstName} {profile.Name?.LastName || matchProfile.lastName}</p>
                </div>
              </div>
              {currentPhoneNumber && (
                <Button
                  variant={markedAccounts.has(currentPhoneNumber) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMarkAsUsed(currentPhoneNumber)}
                  disabled={markingMember === currentPhoneNumber}
                  className={`ml-2 h-8 w-8 p-0 flex-shrink-0 ${markedAccounts.has(currentPhoneNumber) ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                  title={markedAccounts.has(currentPhoneNumber) ? "Marcada como usada" : "Marcar como usada"}
                >
                  {markingMember === currentPhoneNumber ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : markedAccounts.has(currentPhoneNumber) ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              <div className="ml-2 sm:ml-3">
                <p className="text-xs font-medium text-gray-600">Tarjeta</p>
                <p className="text-sm sm:text-base font-bold leading-tight">{profile.CardNumber || matchProfile.loyaltyCardNumber || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              <div className="ml-2 sm:ml-3">
                <p className="text-xs font-medium text-gray-600">Balance</p>
                <p className="text-sm sm:text-base font-bold text-green-600 leading-tight">${typeof rewardData?.CurrentBalanceDollars === 'number' ? rewardData.CurrentBalanceDollars.toFixed(2) : rewardData?.CurrentBalanceDollars ?? '0.00'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              <div className="ml-2 sm:ml-3">
                <p className="text-xs font-medium text-gray-600">Código Postal</p>
                <p className="text-sm sm:text-base font-bold leading-tight">{profile.Address?.ZipCode || rawLookupData?.profile?.zipCode || matchProfile?.zipCode || rawLookupData?.matchProfiles?.[0]?.zipCode || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Nombre:</span>
              <span className="text-xs sm:text-sm font-medium text-right">{profile.Name?.FirstName || matchProfile.firstName} {profile.Name?.LastName || matchProfile.lastName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Email:</span>
              <span className="text-xs sm:text-sm font-medium text-right truncate max-w-[150px]">{profile.EMailAddress?.EMailAddress || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Teléfono:</span>
              <span className="text-xs sm:text-sm font-medium">{phoneList[0] ? `(${phoneList[0].AreaCode}) ${phoneList[0].Number.slice(0,3)}-${phoneList[0].Number.slice(3)}` : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Estado:</span>
              <Badge variant="secondary" className="text-xs">{profile.MemberStatus || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Código Postal:</span>
              <span className="text-xs sm:text-sm font-medium">{profile.Address?.ZipCode || rawLookupData?.profile?.zipCode || matchProfile?.zipCode || rawLookupData?.matchProfiles?.[0]?.zipCode || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Recompensas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Balance:</span>
              <span className="text-xs sm:text-sm font-bold text-green-600">${typeof rewardData?.CurrentBalanceDollars === 'number' ? rewardData.CurrentBalanceDollars.toFixed(2) : rewardData?.CurrentBalanceDollars ?? '0.00'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Puntos:</span>
              <span className="text-xs sm:text-sm font-medium">{rewardData.CurrentBalance ? rewardData.CurrentBalance.toLocaleString() : '0'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Última Actividad:</span>
              <span className="text-xs sm:text-sm font-medium">{rewardData.LastActivityDate ? formatDate(rewardData.LastActivityDate) : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Expiración:</span>
              <span className="text-xs sm:text-sm font-medium">{rewardData.ProjectedForfeitDate ? formatDate(rewardData.ProjectedForfeitDate) : 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Información detallada del perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Información Completa del Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-4">Datos Personales</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID de Miembro:</span>
                  <span className="font-medium">{profile.MemberID || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo de Cliente:</span>
                  <span className="font-medium">{profile.CustomerType || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre Completo:</span>
                  <span className="font-medium">
                    {[profile.Name?.Prefix, profile.Name?.FirstName, profile.Name?.MiddleName, profile.Name?.LastName, profile.Name?.Suffix].filter(Boolean).join(' ') || 
                     (profile.Name?.FirstName ? `${profile.Name.FirstName} ${profile.Name.LastName}` : 'N/A')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Número de Tarjeta:</span>
                  <span className="font-medium">{profile.CardNumber || matchProfile.loyaltyCardNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Registro:</span>
                  <span className="font-medium">{profile.MyWagDateTime ? formatDate(profile.MyWagDateTime) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tiene Mascotas:</span>
                  <span className="font-medium">
                    <Badge variant={profile.PetInd === 'Y' ? 'default' : 'secondary'}>
                      {profile.PetInd === 'Y' ? 'Sí' : 'No'}
                    </Badge>
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Información de Contacto</h3>
              <div className="space-y-3">
                {phoneList.map((phone: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-gray-600">Teléfono ({phone.TypeCode}):</span>
                    <span className="font-medium">({phone.AreaCode}) {phone.Number.slice(0,3)}-{phone.Number.slice(3)}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium truncate max-w-[200px]">{profile.EMailAddress?.EMailAddress || matchProfile.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Código Postal:</span>
                  <span className="font-medium">
                    {profile.Address?.ZipCode || 
                     rawLookupData?.matchProfiles?.[0]?.zipCode || 
                     matchProfile.zipCode || 
                     rawLookupData.zipCode ||
                     sessionMemberData?.zipCode ||
                     'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Servicio de Crédito */}
      {profile.CreditService && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Servicio de Crédito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Criterio de Elegibilidad:</span>
                <span className="font-medium">{profile.CreditService.EligibilityCriteria || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado de Aplicación:</span>
                <span className="font-medium">{profile.CreditService.ApplicationStatus === 'null' ? 'No Aplicado' : profile.CreditService.ApplicationStatus || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Propensity Amount:</span>
                <span className="font-medium">${profile.CreditService.PropensityDetails?.Amount ?? '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Direct Apply:</span>
                <span className="font-medium">{profile.CreditService.DirectApplyPromptFlag === 'Y' ? 'Sí' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acor ID:</span>
                <span className="font-medium text-xs">{profile.CreditService.PropensityDetails?.AcorID || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tienda asignada */}
      {sessionMemberData?.assignedStoreNumber && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg text-red-800 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Mi Tienda Asignada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-red-700">Nombre:</span>
              <span className="text-xs sm:text-sm font-medium text-red-800">{sessionMemberData.assignedStoreName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-red-700">Número:</span>
              <span className="text-xs sm:text-sm font-medium text-red-800">#{sessionMemberData.assignedStoreNumber}</span>
            </div>
            {sessionMemberData.assignedStoreAddress && (
              <div className="flex justify-between items-start">
                <span className="text-xs sm:text-sm text-red-700">Dirección:</span>
                <span className="text-xs sm:text-sm font-medium text-red-800 text-right max-w-[200px]">
                  {sessionMemberData.assignedStoreAddress.street}, {sessionMemberData.assignedStoreAddress.city}, {sessionMemberData.assignedStoreAddress.state} {sessionMemberData.assignedStoreAddress.zipCode}
                </span>
              </div>
            )}
            {sessionMemberData.assignedStorePhone && (
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-red-700">Teléfono:</span>
                <span className="text-xs sm:text-sm font-medium text-red-800">{sessionMemberData.assignedStorePhone}</span>
              </div>
            )}
            {sessionMemberData.storeAssignedAt && (
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-red-700">Asignada el:</span>
                <span className="text-xs sm:text-sm font-medium text-red-800">{formatDate(sessionMemberData.storeAssignedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );



  const renderRewards = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de Recompensas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Balance Actual</h4>
                <p className="text-2xl font-bold text-green-800">${typeof rewardData?.CurrentBalanceDollars === 'number' ? rewardData.CurrentBalanceDollars.toFixed(2) : rewardData?.CurrentBalanceDollars ?? '0.00'}</p>
                <p className="text-sm text-green-600">{rewardData.CurrentBalance ? rewardData.CurrentBalance.toLocaleString() : '0'} puntos</p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Última Actividad</h4>
                <p className="text-sm text-blue-800">{rewardData.LastActivityDate ? formatDate(rewardData.LastActivityDate) : 'N/A'}</p>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2">Fecha de Expiración</h4>
                <p className="text-sm text-red-800">{rewardData.ProjectedForfeitDate ? formatDate(rewardData.ProjectedForfeitDate) : 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Rx Threshold</h4>
                <p className="text-sm text-yellow-800">{rewardData.RxThreshold?.ScriptsTo || 'N/A'} recetas</p>
                <p className="text-xs text-yellow-600">Gana {rewardData.RxThreshold?.PointsAwarded || '0'} puntos</p>
                <p className="text-xs text-yellow-600">Equivale a ${typeof rewardData.RxThreshold?.DollarsAwarded === 'number' ? rewardData.RxThreshold.DollarsAwarded.toFixed(2) : rewardData.RxThreshold?.DollarsAwarded ?? '0.00'}</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">Configuración</h4>
                <p className="text-sm text-purple-800">Smart Prompt: {rewardData.SmartPrompt ? 'Sí' : 'No'}</p>
                <p className="text-sm text-purple-800">Redención: {rewardData.RedemptionDisabled ? 'Deshabilitada' : 'Habilitada'}</p>
                <p className="text-sm text-purple-800">Cuenta Vinculada: {rewardData.LinkedAcctInd ? 'Sí' : 'No'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {pointsExpirations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expiración de Puntos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pointsExpirations.map((expiration: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{expiration.Points} puntos</p>
                      <p className="text-sm text-gray-600">${expiration.Dollars}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Expira el:</p>
                      <p className="text-sm text-red-600">{formatDate(expiration.ExpiresOn)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderPrograms = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Programas y Ofertas Disponibles ({programList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {programList.length > 0 ? (
              programList.map((program: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-green-800">{program.Name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{program.Description}</p>
                      <div className="bg-white rounded-lg p-3 mb-2">
                        <p className="font-medium text-blue-900">{program.Detail}</p>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <Badge variant={program.Value === 'Y' ? 'default' : 'outline'} className="mb-2">
                        {program.Value === 'Y' ? 'Inscrito' : 'Disponible'}
                      </Badge>
                      <p className="text-xs text-gray-500">Código: {program.Code}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-medium text-gray-600">Válido desde:</p>
                      <p className="text-gray-800">{formatDate(program.EffectiveStartDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Válido hasta:</p>
                      <p className="text-gray-800">{formatDate(program.EffectiveEndDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Inscripción hasta:</p>
                      <p className="text-gray-800">{formatDate(program.EnrollmentEndDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Tipo:</p>
                      <Badge variant="secondary" className="text-xs">
                        {program.GlobalFlag ? 'Global' : 'Personalizada'}
                      </Badge>
                    </div>
                  </div>
                  
                  {program.LastOptInDate && (
                    <div className="mt-2 p-2 bg-green-100 rounded-lg">
                      <p className="text-xs text-green-800">
                        <strong>Inscrito el:</strong> {formatDate(program.LastOptInDate)}
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay programas disponibles en este momento.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {rawProgramList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Programas Básicos ({rawProgramList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rawProgramList.map((program: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Código: {program.ProgramCode}</h4>
                      <p className="text-sm text-gray-600">ID: {program.ProgramId}</p>
                      <p className="text-sm text-gray-600">Iniciado: {formatDate(program.ProgramStartDt)}</p>
                    </div>
                    <Badge variant="outline">{program.ProgramStatus === 'A' ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de Comunicación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-4">Consentimientos</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">MyWag Consentimiento:</span>
                  <Badge variant={preferences.MyWagConsentInd ? 'default' : 'secondary'}>
                    {preferences.MyWagConsentInd ? 'Sí' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email Consentimiento:</span>
                  <Badge variant={preferences.EMailConsentInd ? 'default' : 'secondary'}>
                    {preferences.EMailConsentInd ? 'Sí' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">SMS Marketing:</span>
                  <Badge variant={preferences.SmsMktConsentInd ? 'default' : 'secondary'}>
                    {preferences.SmsMktConsentInd ? 'Sí' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mayor de Edad:</span>
                  <Badge variant={preferences.MinAgeInd ? 'default' : 'secondary'}>
                    {preferences.MinAgeInd ? 'Sí' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Configuraciones</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">No Llamar:</span>
                  <Badge variant={preferences.DoNotCallInd ? 'destructive' : 'default'}>
                    {preferences.DoNotCallInd ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">No Enviar Correo:</span>
                  <Badge variant={preferences.DoNotMailInd ? 'destructive' : 'default'}>
                    {preferences.DoNotMailInd ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado Email:</span>
                  <Badge variant={preferences.EMailValidStatus === 'VERIFIED' ? 'default' : 'secondary'}>
                    {preferences.EMailValidStatus || 'N/A'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado SMS:</span>
                  <Badge variant={preferences.SmsValidStatus === 'VERIFIED' ? 'default' : 'secondary'}>
                    {preferences.SmsValidStatus || 'N/A'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recibo Digital:</span>
                  <Badge variant={preferences.DigitalReceiptInd === 'DIGITAL' ? 'default' : 'secondary'}>
                    {preferences.DigitalReceiptInd || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );



  const renderOffers = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Explorador de Ofertas</CardTitle>
        </CardHeader>
        <CardContent>
          <OffersExplorer encLoyaltyId={encLoyaltyId} />
        </CardContent>
      </Card>
    </div>
  );

  const renderStores = () => (
    <div className="space-y-6">
      <StoreLocator />
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6">
      <StoreInventory 
        storeNumber={sessionMemberData?.assignedStoreNumber}
        storeName={sessionMemberData?.assignedStoreName}
      />
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <ProductSearch />
    </div>
  );



  const renderRaw = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos Brutos de la API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Lookup Response</h3>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(rawLookupData, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Member Profile</h3>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(rawMemberData, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );



  const renderContent = () => {
    switch (activeSection) {
      case 'rewards':
        return renderRewards();
      case 'programs':
        return renderPrograms();
      case 'offers':
        return renderOffers();
      case 'stores':
        return renderStores();
      case 'inventory':
        return renderInventory();
      case 'products':
        return renderProducts();
      case 'preferences':
        return renderPreferences();
      case 'raw':
        return renderRaw();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        id="mobile-sidebar"
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:w-64
          flex flex-col h-full
        `}
      >
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="block">
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <p className="text-sm text-gray-600">Miembro Walgreens</p>
            </div>
            <Button
              id="menu-button"
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1 flex-1 min-h-0">
            {/* Admin Menu Section - Only on Mobile */}
            <div className="lg:hidden pb-3 mb-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Administración</h3>
              <div className="space-y-1">
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-2 text-left text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="ml-2 block truncate text-sm">Dashboard</span>
                  </Button>
                </Link>
                <Link href="/admin/accounts">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-2 text-left text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Users className="w-4 h-4" />
                    <span className="ml-2 block truncate text-sm">Cuentas</span>
                  </Button>
                </Link>
                <Link href="/admin/search">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-2 text-left text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Search className="w-4 h-4" />
                    <span className="ml-2 block truncate text-sm">Buscar</span>
                  </Button>
                </Link>
                <Link href="/admin/fast-scan">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-2 text-left text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Zap className="w-4 h-4" />
                    <span className="ml-2 block truncate text-sm">Fast Scanner</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Client Account Menu Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 lg:hidden">Cuenta del Cliente</h3>
              <div className="space-y-1">
                {menuSections.map((section) => {
                  // Build the correct URL based on current URL structure
                  const currentPhone = urlParts[1] === 'admin' && urlParts[2] === 'member' ? urlParts[3] : urlParts[2];
                  const baseUrl = urlParts[1] === 'admin' && urlParts[2] === 'member' 
                    ? `/admin/member/${currentPhone}` 
                    : `/member/${currentPhone}`;
                  
                  return (
                    <Link key={section.id} href={`${baseUrl}/${section.id}`}>
                      <Button
                        variant={activeSection === section.id ? "default" : "ghost"}
                        className="w-full justify-start px-4 text-left lg:text-gray-700 lg:hover:text-gray-900 lg:hover:bg-gray-100 text-green-600 hover:text-green-700 hover:bg-green-50 lg:hover:bg-gray-100"
                        onClick={() => setSidebarOpen(false)} // Close sidebar on mobile when navigating
                      >
                        {section.icon}
                        <span className="ml-2 block truncate">
                          {section.label}
                        </span>
                        {section.count && (
                          <Badge variant="secondary" className="ml-auto block shrink-0">
                            {section.count}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-3 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 lg:mb-6 hidden lg:block">
              <h2 className="text-2xl font-bold text-gray-800">
                {menuSections.find(s => s.id === activeSection)?.label || 'Dashboard'}
              </h2>
              <p className="text-gray-600">
                {profile.Name?.FirstName} {profile.Name?.LastName} - {profile.CardNumber}
              </p>
            </div>
            
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
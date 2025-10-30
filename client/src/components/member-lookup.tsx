import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Toast removed - using console.log instead
import { api } from "@/lib/api";
import { normalizePhoneNumber } from "@/lib/utils";

interface MemberLookupProps {
  onSuccess: (encId: string, profile: any, lookupResponse: any) => void;
  onLoadingChange: (loading: boolean) => void;
}

export default function MemberLookup({ onSuccess, onLoadingChange }: MemberLookupProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Toast removed - using console.log instead

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Apply US phone format (XXX) XXX-XXXX
    if (cleaned.length >= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return cleaned;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow up to 11 digits (for +1 prefix)
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      setPhoneNumber(value); // Store raw input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      console.log("⚠️ Error: Por favor ingresa un número de teléfono");
      return;
    }

    // Normalize phone number (handles +1, 1, and 10-digit formats)
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    
    if (cleanPhone.length !== 10) {
console.log("Toast removed");
      return;
    }

    setIsLoading(true);
    onLoadingChange(true);

    try {
      const result = await api.lookupMember(cleanPhone);
      onSuccess(result.encLoyaltyId, result.rawMemberData, result.rawLookupData);
      console.log("✅ Éxito: ¡Miembro encontrado exitosamente!");
    } catch (error) {
      console.error("Lookup failed:", error);
      console.log("❌ Error: Error al buscar miembro. Por favor verifica tu número de teléfono e intenta nuevamente.");
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">myWalgreens is an easier way to save, shop and stay well</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone">Número de Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="mt-1"
              maxLength={14}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Buscando...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Phone className="mr-2 h-4 w-4" />
                Buscar Miembro
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

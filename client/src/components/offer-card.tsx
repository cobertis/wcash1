import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
// Toast removed - using console.log instead
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { Info } from "lucide-react";

interface OfferCardProps {
  offer: any;
  encLoyaltyId: string;
  variant: "top" | "search" | "clips" | "redeemed";
}

export default function OfferCard({ offer, encLoyaltyId, variant }: OfferCardProps) {
  const [isClipping, setIsClipping] = useState(false);
  const [isUnclipping, setIsUnclipping] = useState(false);

  // Toast removed - using console.log instead
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const clipMutation = useMutation({
    mutationFn: async () => {
      return api.clipOffer(encLoyaltyId, offer.offerId);
    },
    onSuccess: () => {
      console.log("✅ Éxito: Oferta agregada exitosamente!");
      queryClient.invalidateQueries({ queryKey: ["/api/clipped"] });
    },
    onError: (error) => {
      console.log("❌ Error: No se pudo agregar la oferta. Inténtalo de nuevo.");
    },
  });

  const unclipMutation = useMutation({
    mutationFn: async () => {
      return api.unclipOffer(encLoyaltyId, offer.offerId);
    },
    onSuccess: () => {
      console.log("✅ Éxito: Oferta eliminada exitosamente!");
      queryClient.invalidateQueries({ queryKey: ["/api/clipped"] });
    },
    onError: (error) => {
      console.log("❌ Error: No se pudo eliminar la oferta. Inténtalo de nuevo.");
    },
  });

  const handleClipOffer = async () => {
    setIsClipping(true);
    await clipMutation.mutateAsync();
    setIsClipping(false);
  };

  const handleUnclipOffer = async () => {
    setIsUnclipping(true);
    await unclipMutation.mutateAsync();
    setIsUnclipping(false);
  };

  // Removed AI comparison functionality

  const getMemberName = () => {
    const storedData = sessionStorage.getItem('walgreens_lookup_data');
    const memberData = storedData ? JSON.parse(storedData) : null;
    return memberData?.memberData?.profile?.Name ? 
      `${memberData.memberData.profile.Name.FirstName} ${memberData.memberData.profile.Name.LastName}` : 
      'Usuario';
  };

  return (
    <div>
      <Card className="w-full border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-lg">
        <CardContent className="p-4">
          {/* Header with expiry date */}
          <div className="text-center text-sm text-gray-600 mb-3">
            Expires {offer.expiryDate}
          </div>

          {/* Main discount - large and prominent */}
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {offer.discount}
            </div>
          </div>

          {/* Product image and title section */}
          <div className="flex items-center mb-4">
            <div className="w-24 h-24 mr-4 flex-shrink-0">
              {offer.imageUrl ? (
                <img
                  src={offer.imageUrl}
                  alt={offer.title}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-gray-400 text-2xl">
                    {offer.category === "Beauty" && "💄"}
                    {offer.category === "Personal Care" && "🧴"}
                    {offer.category === "Household" && "🏠"}
                    {offer.category === "Medicines & Treatments" && "💊"}
                    {offer.category === "Grocery" && "🛒"}
                    {!["Beauty", "Personal Care", "Household", "Medicines & Treatments", "Grocery"].includes(offer.category) && "🎯"}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {offer.brandName || offer.title}
              </h3>
              <p className="text-sm text-gray-700 leading-tight line-clamp-4">
                {offer.description}
              </p>
            </div>
          </div>

          {/* View details link */}
          <div className="text-center mb-4">
            <Dialog>
              <DialogTrigger asChild>
                <button className="text-blue-600 underline text-sm hover:text-blue-800">
                  View details
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-lg">{offer.title}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Large image in dialog */}
                  <div className="flex justify-center mb-4">
                    {offer.imageUrl ? (
                      <img
                        src={offer.imageUrl}
                        alt={offer.title}
                        className="w-32 h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-3xl">
                          {offer.category === "Beauty" && "💄"}
                          {offer.category === "Personal Care" && "🧴"}
                          {offer.category === "Household" && "🏠"}
                          {offer.category === "Medicines & Treatments" && "💊"}
                          {offer.category === "Grocery" && "🛒"}
                          {!["Beauty", "Personal Care", "Household", "Medicines & Treatments", "Grocery"].includes(offer.category) && "🎯"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Discount and Brand */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600 mb-2">
                      {offer.discount}
                    </div>
                    <div className="text-sm text-gray-700">
                      {offer.brandName} • {offer.categoryName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Expires: {offer.expiryDate}
                    </div>
                  </div>

                  {/* Offer Description */}
                  <div id="offer-description" className="mb-4 text-sm text-gray-700">
                    {offer.description}
                  </div>

                  {/* Terms and Conditions */}
                  <div className="border-t pt-4 text-xs text-gray-600">
                    <div className="font-semibold mb-2">Terms and Conditions</div>
                    <div className="leading-relaxed">
                      {offer.offerDisclaimer ? (
                        <p>{offer.offerDisclaimer}</p>
                      ) : (
                        <p>
                          Valid on your first product. Inventory for participating product(s) may vary in store and online. 
                          Coupon may only be redeemed once, and is only valid when used with your myWalgreens™ membership. 
                          If you received the same coupon by mail, you can redeem either the digital or paper version - 
                          but not both. Offer valid only at participating Walgreens and Duane Reade stores. 
                          Customer is responsible for any sales tax. No cash back. Void if copied and where prohibited by law.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3">
            {variant === "clips" ? (
              <Button
                onClick={handleUnclipOffer}
                disabled={isUnclipping}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white font-medium py-3 rounded-full"
              >
                {isUnclipping ? "Removing..." : "Remove"}
              </Button>
            ) : (
              <Button
                onClick={handleClipOffer}
                disabled={isClipping}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white font-medium py-3 rounded-full"
              >
                {isClipping ? "Clipping..." : "Clip"}
              </Button>
            )}
            <Button 
              variant="outline"
              className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 rounded-full"
              onClick={() => {
console.log("Toast removed");
              }}
            >
              Shop
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
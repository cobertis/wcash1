import { User, CreditCard, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MemberProfileProps {
  profile: {
    name: string;
    cardNumber: string;
    balance: string;
  };
}

export default function MemberProfile({ profile }: MemberProfileProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Member Profile</h2>
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <User className="text-primary mr-2 h-5 w-5" />
              <span className="text-sm text-gray-600">Name</span>
            </div>
            <p className="text-lg font-medium text-gray-900">{profile.name}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <CreditCard className="text-primary mr-2 h-5 w-5" />
              <span className="text-sm text-gray-600">Card Number</span>
            </div>
            <p className="text-lg font-medium text-gray-900">{profile.cardNumber}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Coins className="text-primary mr-2 h-5 w-5" />
              <span className="text-sm text-gray-600">Balance</span>
            </div>
            <p className="text-lg font-medium text-green-600">{profile.balance}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

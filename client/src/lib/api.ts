import { apiRequest } from "./queryClient";

export interface LookupResponse {
  encLoyaltyId: string;
  profile: {
    name: string;
    cardNumber: string;
    balance: string;
  };
  rawLookupData?: any;
  rawMemberData?: any;
  phoneNumber?: string;
}

export interface MemberProfile {
  name: string;
  cardNumber: string;
  balance: string;
  profile?: any;
}

export interface Offer {
  offerId: string;
  title: string;
  description: string;
  discount: string;
  category: string;
  imageUrl?: string;
  expiryDate: string;
  status: string;
}

export interface OffersResponse {
  offers: Offer[];
  totalCount: number;
  page: number;
  size: number;
}

export interface ClippedOffer {
  offerId: string;
  title: string;
  description: string;
  discount: string;
  expiryDate: string;
  status: string;
  clippedAt: string;
}

export interface RedeemedOffer {
  offerId: string;
  title: string;
  description: string;
  redeemedDate: string;
  storeLocation: string;
  savings: string;
}

export interface FilterOptions {
  category?: string;
  minValue?: number;
  maxValue?: number;
  brand?: string;
  expiringBefore?: string;
  offerType?: string;
  sortBy?: 'value' | 'expiry' | 'brand' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface OfferStats {
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

export const api = {
  lookupMember: async (phoneNumber: string): Promise<LookupResponse> => {
    const response = await apiRequest("/api/lookup", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    });
    return response.json();
  },

  getMember: async (encId: string): Promise<MemberProfile> => {
    const response = await apiRequest(`/api/member/${encId}`, {
      method: "GET",
    });
    return response.json();
  },

  getCategoryCounts: async (encId: string): Promise<{ category: string; count: number }[]> => {
    const response = await apiRequest(`/api/category-counts?encId=${encId}`, {
      method: "GET",
    });
    return response.json();
  },

  fetchOffers: async (encId: string, page = 1, size = 20, category?: string): Promise<OffersResponse> => {
    const params = new URLSearchParams({
      encId,
      page: page.toString(),
      size: size.toString(),
      ...(category && category !== "all" && { category }),
    });
    const response = await apiRequest(`/api/offers?${params}`, {
      method: "GET",
    });
    return response.json();
  },

  searchOffers: async (encId: string, query: string, type?: string, page = 1, size = 20): Promise<OffersResponse> => {
    const params = new URLSearchParams({
      encId,
      q: query,
      page: page.toString(),
      size: size.toString(),
      ...(type && type !== "all" && { type }),
    });
    const response = await apiRequest(`/api/search?${params}`, {
      method: "GET",
    });
    return response.json();
  },

  clipOffer: async (encId: string, offerId: string, channel = "web"): Promise<{ success: boolean; message: string }> => {
    const response = await apiRequest("/api/clip", {
      method: "POST",
      body: JSON.stringify({ encId, offerId, channel }),
    });
    return response.json();
  },

  unclipOffer: async (encId: string, offerId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiRequest("/api/unclip", {
      method: "POST",
      body: JSON.stringify({ encId, offerId }),
    });
    return response.json();
  },

  getClippedOffers: async (encId: string, page = 1, size = 20): Promise<{ clippedOffers: ClippedOffer[]; totalCount: number }> => {
    const params = new URLSearchParams({
      encId,
      page: page.toString(),
      size: size.toString(),
    });
    const response = await apiRequest(`/api/clipped?${params}`, {
      method: "GET",
    });
    return response.json();
  },

  getRedeemedOffers: async (encId: string, start?: string, end?: string, page = 1, size = 20): Promise<{ redeemedOffers: RedeemedOffer[] }> => {
    const params = new URLSearchParams({
      encId,
      page: page.toString(),
      size: size.toString(),
      ...(start && { start }),
      ...(end && { end }),
    });
    const response = await apiRequest(`/api/redeemed?${params}`, {
      method: "GET",
    });
    return response.json();
  },

  getOfferStats: async (encId: string): Promise<OfferStats> => {
    const response = await apiRequest(`/api/offers/stats/${encId}`, {
      method: "GET",
    });
    return response.json();
  },

  getFilteredOffers: async (encId: string, filters: FilterOptions, page = 1, size = 20): Promise<OffersResponse> => {
    const response = await apiRequest("/api/offers/filtered", {
      method: "POST",
      body: JSON.stringify({
        encLoyaltyId: encId,
        filters,
        page,
        size,
      }),
    });
    return response.json();
  },

  clipAllOffers: async (encId: string): Promise<{
    success: boolean;
    message: string;
    clippedCount: number;
    failedCount: number;
    totalOffers: number;
    results: any[];
  }> => {
    const response = await apiRequest("/api/clip-all", {
      method: "POST",
      body: JSON.stringify({ encId }),
    });
    return response.json();
  },
};

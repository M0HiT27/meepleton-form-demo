import api from '../axios-instance';
import { API_ENDPOINTS } from '../endpoints';

// 1. Define matching TypeScript types based on your function's response shape
export interface ClientGame {
  id: number;
  name: string;
  genre: string;
  requiredPlayers: number;
  maxSlots: number;
  estimatedRuntimeMinutes: number;
  currentBookedSlots: number;
  availableSlots: number;
}

export interface ClientPass {
  id: number;
  name: string;
  description: string;
  requiredSelectionCount: number;
  pricing: {
    basePrice: number;
    discountedPrice: number;
    hasActiveDiscount: boolean;
    discountPercent: number;
    savings: number;
    discountName: string | null;
    discountEndsAtMs: number | null;
  };
  games: ClientGame[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PurchasePassPayload {
  pass_id: number;
  selected_game_ids: number[];
  buyer: {
    name: string;
    email: string;
    mobile: string;
    dial_code:string;
    city: string;
    pincode: string;
    address: string;
  };
}
 
interface PurchasePassResponse {
  transactionId: number;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
// 2. Export the collective fetching function
export const passService = {
  getAll: async (): Promise<ClientPass[]> => {
    const response = await api.get<ApiResponse<ClientPass[]>>(API_ENDPOINTS.PASS.GET_PASSES);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch passes');
    }

    return response.data.data;
  },
  getById: async (id: string): Promise<ClientPass> => {
    const response = await api.get<ApiResponse<ClientPass>>(API_ENDPOINTS.PASS.GET_PASS_BY_ID(id));

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || `Failed to fetch pass with ID: ${id}`);
    }

    return response.data.data;
  },
  purchaseAPass: async (data: PurchasePassPayload): Promise<PurchasePassResponse> => {
  try {
    const response = await api.post<ApiResponse<PurchasePassResponse>>(
      API_ENDPOINTS.PURCHASE.PURCHASE_A_PASS,
      data // <- was missing entirely; the request body never actually reached the server before
    );
 
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to purchase a pass');
    }
 
    return response.data.data; // <- was missing; caller had no way to get transactionId/razorpayOrderId back
  } catch (err: any) {
    // Surface the backend's specific error message (e.g. "Game X just sold
    // out", "You already have a payment in progress") rather than a generic
    // one, since /api/purchases returns meaningful 400/409 error strings
    // the user should actually see.
    const message =
      err?.response?.data?.error ?? err?.message ?? 'Failed to purchase a pass';
    throw new Error(message);
  }
},
};
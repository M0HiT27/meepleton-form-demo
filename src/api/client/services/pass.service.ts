import api from '../axios-instance';
import { API_ENDPOINTS } from '../endpoints';

// 1. Define matching TypeScript types based on your function's response shape
export interface ClientGame {
  id: string;
  name: string;
  genre: string;
  requiredPlayers: number;
  maxSlots: number;
  estimatedRuntimeMinutes: number;
  current_booked_slots: number;
}

export interface ClientPass {
  id: string;
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
  }
};
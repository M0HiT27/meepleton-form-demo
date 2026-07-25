export const API_ENDPOINTS = {
  PASS: {
    GET_PASSES: '/api/passes',
    GET_PASS_BY_ID: (id: string) => `/api/passes/${id}`,
  },
  PURCHASE:{
    PURCHASE_A_PASS:"/api/purchases"

  }
} as const;
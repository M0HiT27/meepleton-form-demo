export const API_ENDPOINTS = {
  PASS: {
    GET_PASSES: '/api/passes',
    GET_PASS_BY_ID: (id: string) => `/api/passes/${id}`,
  },
} as const;
import axios from 'axios';

const api = axios.create({
  // No baseURL needed if calling internal Next.js routes; it uses the window context.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, 
});

// Response Interceptor for cleaner error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('🌐 Client API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
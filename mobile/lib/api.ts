import axios from 'axios';

// Backend API URL — Change this to your server IP
const API_URL = 'http://192.168.110.58:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
export { API_URL };

// Import axios
import axios from 'axios';

const API_URL = 'http://localhost:8170'; // Update with your server's URL

const API = {
  GetChatbotResponse: async message => {
    try {
      const response = await axios.post(`${API_URL}/getChatbotResponse`, { message });
      console.log("response: ", response.data.response)
      return response.data.response;
    } 
    catch (error) {
      console.error('Error calling server:', error);
      throw error;
    }
  }
};

export default API;

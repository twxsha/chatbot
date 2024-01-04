const API = {
  GetChatbotResponse: async message => {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        if (message === "default") resolve("Hey, I'm Marcus, your AI hiring assistant. Describe your ideal hire and I'll search hundreds of thousands of candidates to find the perfect fit. How can I help?");
        else resolve("processing query: working in progress");
        // api call here
      }, 500);
    });
  }
};

export default API;

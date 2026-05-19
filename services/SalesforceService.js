// services/SalesforceService.js

const axios = require("axios");

class SalesforceService {
  constructor() {
    this.config = {
      tokenUrl: process.env.SALESFORCE_TOKEN_URL,
      clientId: process.env.SALESFORCE_CLIENT_ID,
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
      // username: process.env.SALESFORCE_USERNAME,
      // password: process.env.SALESFORCE_PASSWORD,
      apiUrl: "https://arabianestates.my.salesforce.com/services/apexrest/websiteleads",
    };
  }

  async getToken() {
    try {
      const resp = await axios.post(this.config.tokenUrl, null, {
        params: {
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username: this.config.username,
          password: this.config.password,
        },
      });
      console.log("✓ Salesforce token retrieved");
      return resp.data.access_token;
    } catch (error) {
      console.error("❌ Failed to get Salesforce token:", error.message);
      throw error;
    }
  }

  async sendLead(data) {
    try {
      const token = await this.getToken();
      console.log("📤 Sending data to Salesforce:", data);
      const response = await axios.post(this.config.apiUrl, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      console.log("✓ Successfully sent to Salesforce:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Error sending to Salesforce:", error.response?.data || error.message);
      throw error;
    }
  }
  async syncWithRetry(Model, documentId, salesforceData) {
    try {
      await this.sendLead(salesforceData);
      await Model.findByIdAndUpdate(documentId, {
        salesforceSynced: true,
      });
      console.log(`✓ Document ${documentId} marked as synced`);
    } catch (error) {
      console.error(`✗ Sync failed for ${documentId}:`, error.message);
    }
  }
}

module.exports = new SalesforceService();
import { type BalanceRewardsActivity, type BalanceRewardsToken, type SubmitActivityRequest } from "@shared/schema";

interface BalanceRewardsConfig {
  affiliateId: string;
  apiKey: string;
  redirectUri: string;
  baseUrl: string;
}

interface OAuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  state: string;
  transaction_id: string;
}

interface ActivitySubmissionResponse {
  success: boolean;
  message: string;
  points_awarded?: number;
  transaction_id?: string;
  error_code?: string;
  error_message?: string;
}

export class BalanceRewardsService {
  private config: BalanceRewardsConfig;

  constructor() {
    this.config = {
      affiliateId: process.env.WALGREENS_BALANCE_REWARDS_AFF_ID || process.env.WALGREENS_AFF_ID || '',
      apiKey: process.env.WALGREENS_BALANCE_REWARDS_API_KEY || process.env.WALGREENS_API_KEY || '',
      redirectUri: process.env.WALGREENS_REDIRECT_URI || 'http://localhost:5000/api/balance-rewards/callback',
      baseUrl: 'https://services.walgreens.com/api', // Production URL
    };
    
    console.log('=== BALANCE REWARDS CONFIG (OFICIAL) ===');
    console.log('Affiliate ID:', this.config.affiliateId);
    console.log('API Key:', this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'NOT SET');
    console.log('Base URL:', this.config.baseUrl);
    console.log('Redirect URI:', this.config.redirectUri);
    console.log('========================================');
  }

  // Generate OAuth authorization URL (official Walgreens format)
  generateAuthUrl(state: string = Math.random().toString(36).substring(7)): string {
    const transactionId = Date.now().toString().substring(0, 16);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.affiliateId,
      redirect_uri: this.config.redirectUri,
      scope: 'steps',
      transaction_id: transactionId,
      channel: '1',
      state: state
    });

    const authUrl = `https://www.walgreens.com/oauth/authorize.jsp?${params.toString()}`;
    
    console.log('=== BALANCE REWARDS AUTH URL (OFICIAL) ===');
    console.log('Generated OAuth URL:', authUrl);
    console.log('State:', state);
    console.log('Transaction ID:', transactionId);
    console.log('Scope:', 'steps');
    console.log('Channel:', '5');
    console.log('Redirect URI:', this.config.redirectUri);
    console.log('==========================================');
    
    return authUrl;
  }

  // Exchange authorization code for access token (official Walgreens format)
  async exchangeCodeForToken(code: string, state: string, transactionId: string): Promise<OAuthResponse> {
    const tokenUrl = `${this.config.baseUrl}/oauthtoken/v1`;
    
    const payload = {
      grant_type: 'authorization_code',
      client_id: this.config.affiliateId,
      client_secret: this.config.apiKey,
      code: code,
      redirect_uri: this.config.redirectUri,
      transaction_id: transactionId,
      channel: '5',
      act: 'getOAuthToken',
      state: state
    };

    console.log('=== BALANCE REWARDS TOKEN EXCHANGE (OFICIAL) ===');
    console.log('URL:', tokenUrl);
    console.log('Payload:', { ...payload, client_secret: '[REDACTED]' });
    console.log('===============================================');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(payload).toString()
    });

    const responseText = await response.text();
    console.log('=== TOKEN EXCHANGE RESPONSE (OFICIAL) ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('=========================================');

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  // Submit activity data to Walgreens Balance Rewards API (official endpoint)
  async submitActivity(memberPhone: string, accessToken: string, activityData: SubmitActivityRequest): Promise<ActivitySubmissionResponse> {
    const activityUrl = `${this.config.baseUrl}/steps/activity/v1?apiKey=${this.config.apiKey}`;
    
    // Convert our activity data to Walgreens format
    const walgreensActivity = this.convertToWalgreensFormat(activityData);
    
    // Insert access token into the request
    walgreensActivity.creates[0].access_token = accessToken;
    
    console.log('=== BALANCE REWARDS ACTIVITY SUBMISSION (OFICIAL) ===');
    console.log('URL:', activityUrl);
    console.log('Member Phone:', memberPhone);
    console.log('Activity Type:', activityData.activityType);
    console.log('Activity Data:', JSON.stringify(walgreensActivity, null, 2));
    console.log('Access Token:', accessToken ? accessToken.substring(0, 20) + '...' : 'NOT SET');
    console.log('====================================================');

    const response = await fetch(activityUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(walgreensActivity)
    });

    const responseText = await response.text();
    console.log('=== ACTIVITY SUBMISSION RESPONSE (OFICIAL) ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('==============================================');

    if (!response.ok) {
      return {
        success: false,
        message: `Activity submission failed: ${response.status}`,
        error_code: response.status.toString(),
        error_message: responseText
      };
    }

    try {
      const result = JSON.parse(responseText);
      return {
        success: true,
        message: 'Activity submitted successfully',
        points_awarded: result.points_awarded || 0,
        transaction_id: result.transaction_id || result.transaction_id
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to parse response',
        error_message: responseText
      };
    }
  }

  // Test multiple activity submission endpoints
  async testActivitySubmission(memberPhone: string, accessToken: string, activityData: SubmitActivityRequest): Promise<ActivitySubmissionResponse> {
    const endpoints = [
      '/activity/submit',
      '/rewards/activity',
      '/health/activity',
      '/member/activity'
    ];

    console.log('=== TESTING MULTIPLE ACTIVITY ENDPOINTS ===');
    console.log('Testing', endpoints.length, 'different endpoints');
    console.log('Member Phone:', memberPhone);
    console.log('Activity Type:', activityData.activityType);
    console.log('===========================================');

    for (const endpoint of endpoints) {
      try {
        const fullUrl = `${this.config.baseUrl}${endpoint}`;
        const walgreensActivity = this.convertToWalgreensFormat(activityData);
        
        console.log(`\n=== TESTING ENDPOINT: ${endpoint} ===`);
        console.log('Full URL:', fullUrl);
        
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Affiliate-ID': this.config.affiliateId
          },
          body: JSON.stringify(walgreensActivity)
        });

        const responseText = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', responseText);
        
        if (response.ok) {
          console.log('✅ SUCCESS with endpoint:', endpoint);
          const result = JSON.parse(responseText);
          return {
            success: true,
            message: `Activity submitted successfully via ${endpoint}`,
            points_awarded: result.points_awarded || 0,
            transaction_id: result.transaction_id
          };
        } else {
          console.log('❌ FAILED with endpoint:', endpoint);
        }
      } catch (error) {
        console.log('❌ ERROR with endpoint:', endpoint, error.message);
      }
    }

    return {
      success: false,
      message: 'All activity submission endpoints failed',
      error_message: 'No valid endpoint found for activity submission'
    };
  }

  // Convert our activity format to official Walgreens Balance Rewards format
  private convertToWalgreensFormat(activityData: SubmitActivityRequest): any {
    const now = new Date();
    const transactionId = Date.now().toString().substring(0, 16);
    const uniqueId = `${activityData.memberPhone}_${transactionId}_${Math.random().toString(36).substring(2, 15)}`;
    
    const baseRequest = {
      creates: [{
        access_token: "", // Will be filled by calling method
        affiliate_id: this.config.affiliateId,
        transaction_id: transactionId,
        date: now.toISOString().split('T')[0], // YYYY-MM-DD format
        user_device_id: activityData.memberPhone,
        manufacturer_name: "WalgreensOffers",
        device_name: "OffersExplorer",
        data: [{
          id: uniqueId,
          device_tracked: "true",
          timestamp: now.toISOString().replace('T', ' ').substring(0, 19), // YYYY-MM-DD HH:MM:SS format
          type: "",
          value: {}
        }]
      }]
    };

    // Map activity types to official Walgreens format
    const activityMapping = {
      'walking': 'walking',
      'running': 'running',
      'biking': 'biking',
      'exercise': 'general_exercise',
      'weight_management': 'weight',
      'steps': 'total_steps',
      'blood_pressure': 'blood_pressure',
      'blood_glucose': 'blood_glucose',
      'sleep': 'sleep'
    };

    const walgreensType = activityMapping[activityData.activityType] || 'total_steps';
    baseRequest.creates[0].data[0].type = walgreensType;

    // Format value based on activity type
    switch (walgreensType) {
      case 'total_steps':
        baseRequest.creates[0].data[0].value = parseInt(activityData.activityData.steps) || 1000;
        break;
        
      case 'walking':
      case 'running':
        baseRequest.creates[0].data[0].value = {
          duration: parseInt(activityData.activityData.duration) || 600,
          distance: parseFloat(activityData.activityData.distance) || 1,
          steps: parseInt(activityData.activityData.steps) || 2000
        };
        break;
        
      case 'biking':
        baseRequest.creates[0].data[0].value = {
          duration: parseInt(activityData.activityData.duration) || 3600,
          distance: parseFloat(activityData.activityData.distance) || 5
        };
        break;
        
      case 'general_exercise':
        baseRequest.creates[0].data[0].value = {
          duration: parseInt(activityData.activityData.duration) || 3600,
          type: activityData.activityData.exerciseType || "General Exercise"
        };
        break;
        
      case 'weight':
        baseRequest.creates[0].data[0].value = parseFloat(activityData.activityData.weight) || 168;
        break;
        
      case 'blood_pressure':
        baseRequest.creates[0].data[0].value = {
          systolic: parseInt(activityData.activityData.systolic) || 120,
          diastolic: parseInt(activityData.activityData.diastolic) || 80
        };
        break;
        
      case 'blood_glucose':
        baseRequest.creates[0].data[0].value = {
          value: parseFloat(activityData.activityData.glucose) || 100,
          medicine_relation: activityData.activityData.medicineRelation || "Pre-Medicine",
          meal_relation: activityData.activityData.mealRelation || "Pre",
          meal: activityData.activityData.meal || "Breakfast"
        };
        break;
        
      case 'sleep':
        baseRequest.creates[0].data[0].value = {
          duration: parseInt(activityData.activityData.duration) || 28800, // 8 hours
          quality: activityData.activityData.quality || "Normal"
        };
        break;
        
      default:
        baseRequest.creates[0].data[0].value = 1000;
    }

    return baseRequest;
  }

  // Get Balance Rewards points total (official endpoint)
  async getPointsTotal(accessToken: string): Promise<{ success: boolean; points?: number; message: string; data?: any }> {
    const pointsUrl = `${this.config.baseUrl}/steps/brpoints/v1?apiKey=${this.config.apiKey}`;
    
    console.log('=== BALANCE REWARDS POINTS TOTAL (OFICIAL) ===');
    console.log('URL:', pointsUrl);
    console.log('Access Token:', accessToken ? accessToken.substring(0, 20) + '...' : 'NOT SET');
    console.log('==============================================');

    const response = await fetch(pointsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log('=== POINTS TOTAL RESPONSE (OFICIAL) ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('======================================');

    if (!response.ok) {
      return {
        success: false,
        message: `Points total request failed: ${response.status}`,
        data: { error: responseText }
      };
    }

    try {
      const result = JSON.parse(responseText);
      return {
        success: true,
        points: result.total_points || result.points || 0,
        message: 'Points total retrieved successfully',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to parse points response',
        data: { error: responseText }
      };
    }
  }

  // Direct activity submission with official API format
  async submitActivityDirect(phoneNumber: string, activityType: string, activityData: any): Promise<ActivitySubmissionResponse> {
    const endpoint = '/steps/activity/v1';
    // API key goes in URL as parameter (formato oficial)
    const fullUrl = `${this.config.baseUrl}${endpoint}?apiKey=${this.config.apiKey}`;
    
    const transactionId = Date.now().toString().substring(0, 16);
    const uniqueId = `${phoneNumber}_${transactionId}_${Math.random().toString(36).substring(2, 15)}`;
    
    const payload = {
      creates: [{
        access_token: null, // Token OAuth requerido pero no disponible
        affiliate_id: this.config.affiliateId,
        transaction_id: transactionId,
        date: new Date().toISOString().split('T')[0],
        user_device_id: phoneNumber,
        manufacturer_name: "WalgreensOffers",
        device_name: "OffersExplorer",
        data: [{
          id: uniqueId,
          device_tracked: "true",
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: activityType || "total_steps",
          value: activityData
        }]
      }]
    };

    console.log('=== DIRECT ACTIVITY SUBMISSION (OFICIAL) ===');
    console.log('URL:', fullUrl.replace(this.config.apiKey, this.config.apiKey.substring(0, 10) + '...'));
    console.log('Phone:', phoneNumber);
    console.log('Activity Type:', activityType);
    console.log('Activity Data:', activityData);
    console.log('Transaction ID:', transactionId);
    console.log('===============================================');

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'affId': this.config.affiliateId
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('=== DIRECT SUBMISSION RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Response:', responseText);
      console.log('=================================');

      if (response.ok) {
        try {
          const result = JSON.parse(responseText);
          
          // Check for API error in response
          if (result.errCode && result.errCode !== "000") {
            if (result.errCode === "403" && result.errMsg === "Key doesn't Exists") {
              return {
                success: false,
                message: "Balance Rewards API requiere credenciales específicas del developer portal de Walgreens. Las credenciales actuales son para ofertas/miembros.",
                error_code: result.errCode,
                error_message: "Necesitas registrarte en https://developer.walgreens.com y solicitar API key para 'Balance Rewards'"
              };
            }
            return {
              success: false,
              message: `API Error: ${result.errMsg || 'Unknown error'}`,
              error_code: result.errCode,
              error_message: result.errMsg
            };
          }
          
          return {
            success: true,
            message: 'Activity submitted successfully to Balance Rewards API',
            points_awarded: result.points_awarded || 100,
            transaction_id: transactionId
          };
        } catch (parseError) {
          // If response is not JSON, check if it's an HTML error page
          if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
            return {
              success: false,
              message: 'API returned HTML error page instead of JSON',
              error_code: 'HTML_ERROR',
              error_message: 'Server returned HTML error page'
            };
          }
          
          return {
            success: true,
            message: 'Activity submitted successfully (response not JSON)',
            transaction_id: transactionId
          };
        }
      } else {
        try {
          const errorResult = JSON.parse(responseText);
          if (errorResult.error_code === "1051" && errorResult.error === "invalid_token") {
            return {
              success: false,
              message: "Se requiere flujo OAuth completo. El usuario debe autorizar la aplicación primero.",
              error_code: errorResult.error_code,
              error_message: "Access token requerido - debe completar autorización OAuth"
            };
          }
        } catch (parseError) {
          // Continue with general error handling
        }
        
        return {
          success: false,
          message: `Balance Rewards API submission failed: ${response.status}`,
          error_code: response.status.toString(),
          error_message: responseText
        };
      }
    } catch (error) {
      console.error('Direct submission error:', error);
      return {
        success: false,
        message: 'Network error during submission',
        error_message: error.message
      };
    }
  }

  // Refresh access token (official endpoint)
  async refreshToken(refreshToken: string, transactionId: string): Promise<OAuthResponse> {
    const tokenUrl = `${this.config.baseUrl}/oauthtoken/v1`;
    
    const payload = {
      grant_type: 'refresh_token',
      act: 'getOAuthToken',
      client_id: this.config.affiliateId,
      client_secret: this.config.apiKey,
      refresh_token: refreshToken,
      redirect_uri: this.config.redirectUri,
      channel: '5',
      transaction_id: transactionId
    };

    console.log('=== BALANCE REWARDS TOKEN REFRESH (OFICIAL) ===');
    console.log('URL:', tokenUrl);
    console.log('Payload:', { ...payload, client_secret: '[REDACTED]', refresh_token: '[REDACTED]' });
    console.log('==============================================');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(payload).toString()
    });

    const responseText = await response.text();
    console.log('=== TOKEN REFRESH RESPONSE (OFICIAL) ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('=======================================');

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  // Deactivate OAuth token (official endpoint)
  async deactivateToken(accessToken: string): Promise<{ success: boolean; message: string; data?: any }> {
    const deactivateUrl = `${this.config.baseUrl}/oauthtoken/delete/v1`;
    
    const payload = {
      act: 'deactivateToken',
      client_id: this.config.affiliateId,
      client_secret: this.config.apiKey,
      token: accessToken,
      channel: '5'
    };

    console.log('=== BALANCE REWARDS TOKEN DEACTIVATE (OFICIAL) ===');
    console.log('URL:', deactivateUrl);
    console.log('Payload:', { ...payload, client_secret: '[REDACTED]', token: '[REDACTED]' });
    console.log('===============================================');

    const response = await fetch(deactivateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(payload).toString()
    });

    const responseText = await response.text();
    console.log('=== TOKEN DEACTIVATE RESPONSE (OFICIAL) ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('==========================================');

    if (!response.ok) {
      return {
        success: false,
        message: `Token deactivation failed: ${response.status}`,
        data: { error: responseText }
      };
    }

    try {
      const result = JSON.parse(responseText);
      return {
        success: true,
        message: 'Token deactivated successfully',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to parse deactivation response',
        data: { error: responseText }
      };
    }
  }

  // Test connection to Balance Rewards API (official format)
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    console.log('=== TESTING BALANCE REWARDS API CONNECTION ===');
    console.log('Base URL:', this.config.baseUrl);
    console.log('API Key:', this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'NOT SET');
    console.log('Affiliate ID:', this.config.affiliateId);
    console.log('==============================================');

    // Test the OAuth authorization URL generation
    const testState = 'test_' + Date.now();
    const authUrl = this.generateAuthUrl(testState);
    
    console.log('✅ OAuth URL generated successfully');
    console.log('Auth URL:', authUrl);
    
    // Test basic endpoint structure
    const testEndpoints = [
      '/oauthtoken/v1',  // Token endpoint
      '/oauth/authorize'  // Auth endpoint (legacy)
    ];
    
    const results = [];
    
    for (const endpoint of testEndpoints) {
      try {
        const testUrl = `${this.config.baseUrl}${endpoint}`;
        console.log(`\n=== TESTING: ${endpoint} ===`);
        console.log('URL:', testUrl);
        
        // Test OPTIONS request first
        const response = await fetch(testUrl, {
          method: 'OPTIONS',
          headers: {
            'Accept': 'application/json',
            'Origin': 'http://localhost:5000'
          }
        });

        const responseText = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', responseText.substring(0, 200) + '...');

        results.push({
          endpoint,
          status: response.status,
          success: response.ok,
          response: responseText
        });

      } catch (error) {
        console.log('❌ ERROR with endpoint:', endpoint, error.message);
        results.push({
          endpoint,
          error: error.message,
          success: false
        });
      }
    }

    return {
      success: true,
      message: 'Balance Rewards API test completed - OAuth URL generated successfully',
      data: {
        authUrl,
        oauthEndpoint: 'https://m-qa2.walgreens.com/oauth/authorize.jsp',
        tokenEndpoint: `${this.config.baseUrl}/oauthtoken/v1`,
        scope: 'steps',
        channel: '5',
        results
      }
    };
  }
}

export const balanceRewardsService = new BalanceRewardsService();
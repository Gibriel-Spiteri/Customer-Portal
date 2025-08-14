import fetch from 'node-fetch';

interface NetSuiteEmailParams {
  type: 'password_reset' | 'welcome';
  email: string;
  customerId?: string;
  resetUrl?: string;
  loginUrl?: string;
}

export class NetSuiteEmailService {
  private baseUrl: string;
  private restletUrl: string;

  constructor() {
    // NetSuite account ID from environment
    const accountId = process.env.NETSUITE_ACCOUNT_ID || '1212804';
    
    // RESTlet deployment ID and script ID (you'll need to update these after deploying the RESTlet)
    const scriptId = process.env.NETSUITE_EMAIL_SCRIPT_ID || 'customscript_email_service';
    const deploymentId = process.env.NETSUITE_EMAIL_DEPLOY_ID || 'customdeploy_email_service';
    
    this.baseUrl = `https://${accountId}.suitetalk.api.netsuite.com`;
    this.restletUrl = `${this.baseUrl}/services/rest/record/v1/script/${scriptId}/deployment/${deploymentId}`;
  }

  /**
   * Send email via NetSuite RESTlet
   */
  async sendEmail(params: NetSuiteEmailParams): Promise<boolean> {
    try {
      // Check if M2M authentication is configured
      const hasM2MConfig = process.env.NETSUITE_CONSUMER_KEY && 
                           process.env.NETSUITE_CONSUMER_SECRET &&
                           process.env.NETSUITE_CERTIFICATE_ID;

      if (!hasM2MConfig) {
        console.warn('NetSuite M2M authentication not configured - email not sent');
        return false;
      }

      // Get OAuth token using M2M authentication
      const { NetSuiteM2M } = await import('./netsuite-m2m');
      const m2m = new NetSuiteM2M();
      
      // Make request to RESTlet
      const response = await m2m.makeRequest(
        this.restletUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(params)
        }
      );

      const result = await response.json();
      
      if (result.success) {
        console.log(`Email sent successfully via NetSuite to ${params.email}`);
        return true;
      } else {
        console.error('NetSuite email error:', result.error);
        return false;
      }
    } catch (error) {
      console.error('NetSuite email service error:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetUrl: string, customerId?: string): Promise<boolean> {
    return this.sendEmail({
      type: 'password_reset',
      email,
      resetUrl,
      customerId
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, customerId: string): Promise<boolean> {
    const loginUrl = process.env.NODE_ENV === 'production' 
      ? process.env.APP_URL + '/login'
      : 'http://localhost:5000/login';

    return this.sendEmail({
      type: 'welcome',
      email,
      customerId,
      loginUrl
    });
  }
}

// Export singleton instance
export const netsuiteEmailService = new NetSuiteEmailService();
import fetch from 'node-fetch';
import { nsLimit } from './ns-limit';

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
    
    // RESTlet deployment ID and script ID - actual deployed values
    const scriptId = process.env.NETSUITE_EMAIL_SCRIPT_ID || 'customscript_portal_password_reset';
    const deploymentId = process.env.NETSUITE_EMAIL_DEPLOY_ID || 'customdeploy_portal_password_reset';
    
    // Use the direct RESTlet URL provided by NetSuite
    this.baseUrl = `https://${accountId}.suitetalk.api.netsuite.com`;
    this.restletUrl = process.env.NETSUITE_EMAIL_RESTLET_URL || 'https://1212804.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=4393&deploy=1';
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
      
      // Get OAuth access token for the request (acquires its own limiter slot,
      // OUTSIDE the RESTlet slot below — non-reentrant, see ns-limit.ts).
      const accessToken = await m2m.getAccessToken();

      // Make request to RESTlet using the direct URL. This RESTlet POST is a
      // real inbound NetSuite call (and uses node-fetch, NOT global fetch), so
      // it must go through the same global concurrency limiter as everything else.
      const result: any = await nsLimit(async () => {
        const response = await fetch(this.restletUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'transient'
          },
          body: JSON.stringify(params)
        });

        return await response.json();
      });
      
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
    // Use the Replit app URL in production
    const baseUrl = process.env.APP_URL || 
                    (process.env.REPL_SLUG && process.env.REPL_OWNER 
                      ? `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`
                      : 'http://localhost:5000');
    const loginUrl = `${baseUrl}/login`;

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
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured - email not sent');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generatePasswordResetEmail(resetUrl: string, email: string): EmailParams {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@customerportal.com';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset the password for your Customer Portal account associated with ${email}.</p>
          <p>To reset your password, please click the button below:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
          <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
          <p>Best regards,<br>Customer Portal Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>© 2024 Customer Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset Request

Hello,

We received a request to reset the password for your Customer Portal account associated with ${email}.

To reset your password, please visit the following link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Customer Portal Team

This is an automated message, please do not reply to this email.
  `;

  return {
    to: email,
    from: fromEmail,
    subject: 'Password Reset Request - Customer Portal',
    text,
    html,
  };
}

export function generateWelcomeEmail(email: string, customerId: string): EmailParams {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@customerportal.com';
  const loginUrl = process.env.NODE_ENV === 'production' 
    ? 'https://customerportal.com/login' 
    : 'http://localhost:5000/login';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .features { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Customer Portal!</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your Customer Portal account has been successfully created!</p>
          <p><strong>Your Customer ID:</strong> ${customerId}</p>
          <p><strong>Your Login Email:</strong> ${email}</p>
          
          <div class="features">
            <h3>With your account, you can:</h3>
            <ul>
              <li>View and track your orders</li>
              <li>Access invoices and payment history</li>
              <li>Download documents and reports</li>
              <li>Manage your account settings</li>
              <li>Submit support tickets</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Login to Your Account</a>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>Customer Portal Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>© 2024 Customer Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Customer Portal!

Hello,

Your Customer Portal account has been successfully created!

Your Customer ID: ${customerId}
Your Login Email: ${email}

With your account, you can:
- View and track your orders
- Access invoices and payment history
- Download documents and reports
- Manage your account settings
- Submit support tickets

Login to your account: ${loginUrl}

If you have any questions, please don't hesitate to contact our support team.

Best regards,
Customer Portal Team

This is an automated message, please do not reply to this email.
  `;

  return {
    to: email,
    from: fromEmail,
    subject: 'Welcome to Customer Portal',
    text,
    html,
  };
}
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope Public
 * 
 * Email Service RESTlet for Customer Portal
 * Handles sending password reset and welcome emails
 */
define(['N/email', 'N/runtime', 'N/log', 'N/record', 'N/search'], 
function(email, runtime, log, record, search) {

    /**
     * Send password reset email
     * @param {Object} params
     * @param {string} params.email - Recipient email
     * @param {string} params.resetUrl - Password reset URL
     * @param {string} params.customerId - NetSuite customer ID
     */
    function sendPasswordResetEmail(params) {
        try {
            const authorId = runtime.getCurrentScript().getParameter({name: 'custscript_email_author_id'}) || -5; // -5 is system
            
            const subject = 'Password Reset Request - Customer Portal';
            
            const htmlBody = `
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
            <p>We received a request to reset the password for your Customer Portal account associated with ${params.email}.</p>
            <p>To reset your password, please click the button below:</p>
            <div style="text-align: center;">
                <a href="${params.resetUrl}" class="button" style="color: white;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${params.resetUrl}</p>
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
</html>`;

            const textBody = `
Password Reset Request

Hello,

We received a request to reset the password for your Customer Portal account associated with ${params.email}.

To reset your password, please visit the following link:
${params.resetUrl}

This link will expire in 1 hour for security reasons.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Customer Portal Team

This is an automated message, please do not reply to this email.`;

            // Look up the customer's internal ID if we have their customer ID
            let recipientId = null;
            if (params.customerId) {
                try {
                    const customerSearch = search.create({
                        type: search.Type.CUSTOMER,
                        filters: [
                            ['entityid', 'is', params.customerId]
                        ],
                        columns: ['internalid']
                    });
                    
                    const searchResult = customerSearch.run().getRange({start: 0, end: 1});
                    if (searchResult.length > 0) {
                        recipientId = searchResult[0].getValue('internalid');
                    }
                } catch (e) {
                    log.error('Customer lookup error', e.toString());
                }
            }

            // Send the email
            email.send({
                author: authorId,
                recipients: params.email,
                subject: subject,
                body: htmlBody,
                isInternalOnly: false,
                relatedRecords: recipientId ? {
                    entityId: recipientId
                } : undefined
            });

            log.audit('Password Reset Email Sent', {
                recipient: params.email,
                customerId: params.customerId
            });

            return {
                success: true,
                message: 'Password reset email sent successfully'
            };

        } catch (e) {
            log.error('Send Password Reset Email Error', e.toString());
            return {
                success: false,
                error: e.toString()
            };
        }
    }

    /**
     * Send welcome email
     * @param {Object} params
     * @param {string} params.email - Recipient email
     * @param {string} params.customerId - NetSuite customer ID
     * @param {string} params.loginUrl - Login URL for the portal
     */
    function sendWelcomeEmail(params) {
        try {
            const authorId = runtime.getCurrentScript().getParameter({name: 'custscript_email_author_id'}) || -5;
            
            const subject = 'Welcome to Customer Portal';
            const loginUrl = params.loginUrl || 'https://customerportal.com/login';
            
            const htmlBody = `
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
            <p><strong>Your Customer ID:</strong> ${params.customerId}</p>
            <p><strong>Your Login Email:</strong> ${params.email}</p>
            
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
                <a href="${loginUrl}" class="button" style="color: white;">Login to Your Account</a>
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
</html>`;

            const textBody = `
Welcome to Customer Portal!

Hello,

Your Customer Portal account has been successfully created!

Your Customer ID: ${params.customerId}
Your Login Email: ${params.email}

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

This is an automated message, please do not reply to this email.`;

            // Look up the customer's internal ID
            let recipientId = null;
            if (params.customerId) {
                try {
                    const customerSearch = search.create({
                        type: search.Type.CUSTOMER,
                        filters: [
                            ['entityid', 'is', params.customerId]
                        ],
                        columns: ['internalid']
                    });
                    
                    const searchResult = customerSearch.run().getRange({start: 0, end: 1});
                    if (searchResult.length > 0) {
                        recipientId = searchResult[0].getValue('internalid');
                    }
                } catch (e) {
                    log.error('Customer lookup error', e.toString());
                }
            }

            // Send the email
            email.send({
                author: authorId,
                recipients: params.email,
                subject: subject,
                body: htmlBody,
                isInternalOnly: false,
                relatedRecords: recipientId ? {
                    entityId: recipientId
                } : undefined
            });

            log.audit('Welcome Email Sent', {
                recipient: params.email,
                customerId: params.customerId
            });

            return {
                success: true,
                message: 'Welcome email sent successfully'
            };

        } catch (e) {
            log.error('Send Welcome Email Error', e.toString());
            return {
                success: false,
                error: e.toString()
            };
        }
    }

    /**
     * POST handler for the RESTlet
     * @param {Object} requestBody
     * @returns {Object} Response
     */
    function doPost(requestBody) {
        try {
            log.debug('Email Service Request', JSON.stringify(requestBody));

            if (!requestBody || !requestBody.type) {
                return {
                    success: false,
                    error: 'Invalid request: missing email type'
                };
            }

            switch(requestBody.type) {
                case 'password_reset':
                    return sendPasswordResetEmail(requestBody);
                case 'welcome':
                    return sendWelcomeEmail(requestBody);
                default:
                    return {
                        success: false,
                        error: 'Unknown email type: ' + requestBody.type
                    };
            }

        } catch (e) {
            log.error('Email Service Error', e.toString());
            return {
                success: false,
                error: 'Failed to process email request: ' + e.toString()
            };
        }
    }

    return {
        post: doPost
    };
});
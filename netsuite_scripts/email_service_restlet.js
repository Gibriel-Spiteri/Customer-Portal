/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope Public
 * 
 * Email Service RESTlet for Customer Portal
 * Handles sending password reset and welcome emails using email template 432
 */
define(['N/email', 'N/runtime', 'N/log', 'N/record', 'N/search', 'N/render'], 
function(email, runtime, log, record, search, render) {

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
     * Send welcome email using email template 432
     * @param {Object} params
     * @param {string} params.email - Recipient email
     * @param {string} params.customerId - NetSuite customer ID
     * @param {string} params.loginUrl - Login URL for the portal
     */
    function sendWelcomeEmail(params) {
        try {
            const authorId = runtime.getCurrentScript().getParameter({name: 'custscript_email_author_id'}) || -5;
            const emailTemplateId = 432; // Email template ID for welcome email
            const loginUrl = params.loginUrl || 'https://customerportal.com/login';
            
            // Look up the customer's internal ID
            let recipientId = null;
            let customerRecord = null;
            
            if (params.customerId && params.customerId !== 'GUEST') {
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
                        // Load customer record for merge fields
                        customerRecord = record.load({
                            type: record.Type.CUSTOMER,
                            id: recipientId
                        });
                    }
                } catch (e) {
                    log.error('Customer lookup error', e.toString());
                }
            }

            let emailSubject = 'Welcome to Customer Portal';
            let emailBody;
            
            // Only try to use template if we have a valid customer record
            if (recipientId) {
                try {
                    // Create merge data for the template
                    const mergeData = {
                        email: params.email,
                        loginUrl: loginUrl,
                        customerId: params.customerId,
                        customerName: customerRecord ? customerRecord.getValue('companyname') || customerRecord.getValue('firstname') + ' ' + customerRecord.getValue('lastname') : '',
                        currentDate: new Date().toLocaleDateString()
                    };

                    // Render the email template with merge data
                    const mergeResult = render.mergeEmail({
                        templateId: emailTemplateId,
                        entity: {
                            type: 'customer',
                            id: recipientId
                        },
                        recipient: {
                            type: 'customer',
                            id: recipientId
                        },
                        customRecord: {
                            type: 'customrecord_email_data',
                            id: null,
                            data: mergeData
                        }
                    });
                    
                    emailSubject = mergeResult.subject || emailSubject;
                    emailBody = mergeResult.body;
                } catch (e) {
                    log.error('Template merge error', e.toString());
                }
            }
            
            // Use fallback if template didn't work or no customer ID
            if (!emailBody) {
                emailBody = `
                    <p>Hello,</p>
                    <p>Your Customer Portal account has been successfully created!</p>
                    <p>Customer ID: ${params.customerId || 'N/A'}</p>
                    <p>Login Email: ${params.email}</p>
                    <p>Login to your account: <a href="${loginUrl}">${loginUrl}</a></p>
                    <p>Best regards,<br>Customer Portal Team</p>
                `;
                log.audit('Using fallback email body', 'Template 432 not used - customer ID: ' + params.customerId);
            }

            // Send the email
            email.send({
                author: authorId,
                recipients: params.email,
                subject: emailSubject,
                body: emailBody,
                isInternalOnly: false,
                relatedRecords: recipientId ? {
                    entityId: recipientId
                } : undefined
            });

            log.audit('Welcome Email Sent', {
                recipient: params.email,
                customerId: params.customerId,
                templateUsed: emailTemplateId
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
     * Sends an email-change verification code
     * @param {Object} params - { email, code, customerId? }
     */
    function sendVerificationCodeEmail(params) {
        try {
            if (!params.email || !params.code) {
                return { success: false, error: 'Missing email or code' };
            }
            const authorId = runtime.getCurrentScript().getParameter({name: 'custscript_email_author_id'}) || -5;
            const subject = 'Your Verification Code - Customer Portal';
            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { font-size: 32px; letter-spacing: 8px; font-weight: bold; text-align: center; padding: 16px; background: #fff; border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verify Your Email Address</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Use the code below to confirm your new email address for the Customer Portal:</p>
            <div class="code">${params.code}</div>
            <p><strong>This code expires in 10 minutes.</strong></p>
            <p>If you did not request this change, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

            email.send({
                author: authorId,
                recipients: params.email,
                subject: subject,
                body: htmlBody,
                isInternalOnly: false
            });

            log.audit('Verification Code Email Sent', { recipient: params.email });
            return { success: true, message: 'Verification email sent' };
        } catch (e) {
            log.error('Verification Email Error', e.toString());
            return { success: false, error: e.toString() };
        }
    }

    /**
     * Set the role on a customer's contact (contacts sublist).
     * REST web services cannot set the built-in roles (-10 Primary, -20 Alternate),
     * so the portal calls this instead after creating a contact.
     * @param {Object} params
     * @param {string} params.customerId - NetSuite customer internal id
     * @param {string} params.contactId - Contact internal id
     * @param {string} [params.roleId] - Role internal id (defaults to -20 Alternate Contact)
     */
    function setContactRole(params) {
        try {
            if (!params.customerId || !params.contactId) {
                return { success: false, error: 'customerId and contactId are required' };
            }
            const roleId = params.roleId || '-20';

            const customer = record.load({
                type: record.Type.CUSTOMER,
                id: params.customerId,
                isDynamic: false
            });

            const lineCount = customer.getLineCount({ sublistId: 'contactroles' });
            let updated = false;
            for (let i = 0; i < lineCount; i++) {
                const lineContact = customer.getSublistValue({ sublistId: 'contactroles', fieldId: 'contact', line: i });
                if (String(lineContact) === String(params.contactId)) {
                    customer.setSublistValue({ sublistId: 'contactroles', fieldId: 'role', line: i, value: roleId });
                    updated = true;
                    break;
                }
            }

            if (!updated) {
                return { success: false, error: 'Contact ' + params.contactId + ' not found on customer ' + params.customerId };
            }

            customer.save();
            log.debug('Contact role set', 'Contact ' + params.contactId + ' on customer ' + params.customerId + ' -> role ' + roleId);
            return { success: true };
        } catch (e) {
            log.error('Set Contact Role Error', e.toString());
            return { success: false, error: e.toString() };
        }
    }

    /**
     * POST handler for the RESTlet
     * @param {Object} requestBody
     * @returns {Object} Response
     */
    function doPost(requestBody) {
        try {
            // Redact sensitive fields (verification codes) from logs
            log.debug('Email Service Request', JSON.stringify(
                requestBody && requestBody.code
                    ? Object.assign({}, requestBody, { code: '******' })
                    : requestBody
            ));

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
                case 'verification_code':
                    return sendVerificationCodeEmail(requestBody);
                case 'set_contact_role':
                    return setContactRole(requestBody);
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
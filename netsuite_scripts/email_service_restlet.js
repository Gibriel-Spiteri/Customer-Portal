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
     * Send password reset email using email template 432
     * @param {Object} params
     * @param {string} params.email - Recipient email
     * @param {string} params.resetUrl - Password reset URL
     * @param {string} params.customerId - NetSuite customer ID
     */
    function sendPasswordResetEmail(params) {
        try {
            const authorId = runtime.getCurrentScript().getParameter({name: 'custscript_email_author_id'}) || -5; // -5 is system
            const emailTemplateId = 432; // Email template ID for password reset
            
            // Look up the customer's internal ID if we have their customer ID
            let recipientId = null;
            let customerRecord = null;
            
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

            // Create a custom record or use a temporary object to hold merge data
            const mergeData = {
                email: params.email,
                resetUrl: params.resetUrl,
                customerId: params.customerId,
                customerName: customerRecord ? customerRecord.getValue('companyname') || customerRecord.getValue('firstname') + ' ' + customerRecord.getValue('lastname') : '',
                currentDate: new Date().toLocaleDateString(),
                expirationTime: '1 hour'
            };

            // Render the email template with merge data
            const mergeResult = render.mergeEmail({
                templateId: emailTemplateId,
                entity: recipientId ? {
                    type: 'customer',
                    id: recipientId
                } : null,
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

            // If template rendering fails, use fallback
            let emailSubject = mergeResult.subject || 'Password Reset Request - Customer Portal';
            let emailBody = mergeResult.body;
            
            // If template is not available or doesn't render, provide a simple fallback
            if (!emailBody) {
                emailBody = `
                    <p>Hello,</p>
                    <p>We received a request to reset your password for ${params.email}.</p>
                    <p>Please click here to reset your password: <a href="${params.resetUrl}">${params.resetUrl}</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,<br>Customer Portal Team</p>
                `;
                log.error('Template 432 not found or failed to render', 'Using fallback email body');
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

            log.audit('Password Reset Email Sent', {
                recipient: params.email,
                customerId: params.customerId,
                templateUsed: emailTemplateId
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
                entity: recipientId ? {
                    type: 'customer',
                    id: recipientId
                } : null,
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

            // If template rendering fails, use fallback
            let emailSubject = mergeResult.subject || 'Welcome to Customer Portal';
            let emailBody = mergeResult.body;
            
            // If template is not available or doesn't render, provide a simple fallback
            if (!emailBody) {
                emailBody = `
                    <p>Hello,</p>
                    <p>Your Customer Portal account has been successfully created!</p>
                    <p>Customer ID: ${params.customerId}</p>
                    <p>Login Email: ${params.email}</p>
                    <p>Login to your account: <a href="${loginUrl}">${loginUrl}</a></p>
                    <p>Best regards,<br>Customer Portal Team</p>
                `;
                log.error('Template 432 not found or failed to render', 'Using fallback email body for welcome email');
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
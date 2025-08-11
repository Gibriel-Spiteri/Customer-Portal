/**
 * Customer Center SAML SSO Suitelet
 * Enhanced version following NetSuite Customer Center SAML guidelines
 * 
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/https', 'N/crypto', 'N/record', 'N/search'], 
    function(runtime, https, crypto, record, search) {
    
    // Configuration - Replace with your actual values
    var SHARED_SECRET = 'YOUR_BASE64_SHARED_SECRET_HERE'; // Must match NETSUITE_SSO_SECRET
    var DEFAULT_CALLBACK_URL = 'https://your-domain.replit.app/api/auth/netsuite/sso';
    
    function onRequest(context) {
        var request = context.request;
        var response = context.response;
        
        try {
            var currentUser = runtime.getCurrentUser();
            
            // Validate customer center access permissions
            var accessValidation = validateCustomerCenterAccess(currentUser);
            if (!accessValidation.valid) {
                throw new Error(accessValidation.error);
            }
            
            // Get customer record details
            var customerData = getCustomerDetails(currentUser);
            
            // Create JWT payload with customer center specific information
            var payload = {
                name: customerData.name,
                email: customerData.email,
                customerId: currentUser.id.toString(),
                entityId: currentUser.entity ? currentUser.entity.toString() : null,
                companyName: customerData.companyName,
                customerCenterAccess: true,
                billingAddress: customerData.billingAddress,
                phone: customerData.phone,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
            };
            
            // Create signed JWT token
            var token = createJWT(payload);
            
            // Get callback URL from request parameters or use default
            var callbackUrl = request.parameters.callback || DEFAULT_CALLBACK_URL;
            
            // Redirect back to customer portal with token
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: callbackUrl + '?sso_token=' + encodeURIComponent(token)
            });
            
        } catch (error) {
            log.error('Customer Center SSO Error', {
                message: error.toString(),
                userId: runtime.getCurrentUser().id,
                userEmail: runtime.getCurrentUser().email
            });
            
            // Customer-friendly error response
            response.write([
                '<html><head><title>Customer Center Access</title></head><body>',
                '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">',
                '<h2 style="color: #d32f2f;">Customer Center Access Error</h2>',
                '<p>We were unable to authenticate your access to the Customer Center.</p>',
                '<p><strong>Possible reasons:</strong></p>',
                '<ul>',
                '<li>Your account may not have Customer Center access enabled</li>',
                '<li>Your customer record may be inactive</li>',
                '<li>Required permissions may not be configured</li>',
                '</ul>',
                '<p>Please contact your account administrator for assistance.</p>',
                '<p><a href="javascript:history.back()" style="color: #1976d2;">← Return to previous page</a></p>',
                '</div></body></html>'
            ].join(''));
        }
    }
    
    /**
     * Validate that the current user has proper customer center access
     */
    function validateCustomerCenterAccess(currentUser) {
        try {
            // Check if user has the required role permissions
            var role = runtime.getCurrentScript().getParameter('custscript_customer_role');
            
            // Verify user has customer center access
            if (!currentUser.id) {
                return {
                    valid: false,
                    error: 'User identification failed'
                };
            }
            
            // Additional validation can be added here
            // For example, checking specific permissions or customer status
            
            return {
                valid: true,
                error: null
            };
            
        } catch (error) {
            log.error('Customer access validation failed', error.toString());
            return {
                valid: false,
                error: 'Access validation failed'
            };
        }
    }
    
    /**
     * Get detailed customer information from NetSuite
     */
    function getCustomerDetails(currentUser) {
        try {
            // Load customer record
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: currentUser.id
            });
            
            // Check if customer is active and has web access
            var isActive = customerRecord.getValue('is_active');
            var hasWebAccess = customerRecord.getValue('giveaccess');
            
            if (!isActive) {
                throw new Error('Customer account is not active');
            }
            
            if (!hasWebAccess) {
                throw new Error('Customer does not have web access enabled');
            }
            
            // Extract customer data
            var customerData = {
                name: currentUser.name,
                email: currentUser.email,
                companyName: customerRecord.getValue('companyname') || customerRecord.getValue('entityid'),
                phone: customerRecord.getValue('phone'),
                billingAddress: formatAddress(customerRecord, 'bill')
            };
            
            return customerData;
            
        } catch (error) {
            log.error('Failed to get customer details', {
                customerId: currentUser.id,
                error: error.toString()
            });
            throw error;
        }
    }
    
    /**
     * Format customer address for inclusion in token
     */
    function formatAddress(customerRecord, prefix) {
        try {
            var address = {
                addr1: customerRecord.getValue(prefix + 'addr1'),
                addr2: customerRecord.getValue(prefix + 'addr2'),
                city: customerRecord.getValue(prefix + 'city'),
                state: customerRecord.getValue(prefix + 'state'),
                zip: customerRecord.getValue(prefix + 'zip'),
                country: customerRecord.getValue(prefix + 'country')
            };
            
            // Format as string
            var parts = [];
            if (address.addr1) parts.push(address.addr1);
            if (address.addr2) parts.push(address.addr2);
            if (address.city) parts.push(address.city);
            if (address.state) parts.push(address.state);
            if (address.zip) parts.push(address.zip);
            
            return parts.join(', ');
            
        } catch (error) {
            log.debug('Address formatting failed', error.toString());
            return null;
        }
    }
    
    /**
     * Create and sign JWT token using HMAC-SHA256
     */
    function createJWT(payload) {
        var header = {
            alg: "HS256",
            typ: "JWT"
        };
        
        var encodedHeader = base64urlEncode(JSON.stringify(header));
        var encodedPayload = base64urlEncode(JSON.stringify(payload));
        var message = encodedHeader + '.' + encodedPayload;
        
        // Create HMAC signature using NetSuite crypto module
        var hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: SHARED_SECRET
        });
        
        hmac.update({
            input: message
        });
        
        var signature = base64urlEncode(hmac.digest());
        
        return message + '.' + signature;
    }
    
    /**
     * Base64 URL encode (JWT standard)
     */
    function base64urlEncode(str) {
        if (typeof str === 'string') {
            return btoa(str)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        } else {
            // For crypto digest (already base64)
            return str.replace(/\+/g, '-')
                      .replace(/\//g, '_')
                      .replace(/=/g, '');
        }
    }
    
    return {
        onRequest: onRequest
    };
});
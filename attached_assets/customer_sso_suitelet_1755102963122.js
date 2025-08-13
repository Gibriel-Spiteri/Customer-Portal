/**
 * @NApiVersion 2.1
 * @NScriptType SuiteLet
 */

define(['N/redirect', 'N/encode', 'N/crypto', 'N/runtime', 'N/record'], function (redirect, encode, crypto, runtime, record) {
    const JWT_EXPIRATION_TIME = 3600; // JWT expiration time in seconds (1 hour)
    const AUDIENCE = 'replit.dev';
    const ISSUER = 'https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4390&deploy=1'; // Customer script
    const SECRET_ID = 'custsecret_portal_sso'; // Same secret ID from secrets management page

    function onRequest(context) {
        const REDIRECT_URL = `https://2fdee256-490e-452c-b9d3-9acfca1ecfa0.worf.prod.repl.run/api/auth/netsuite/sso?sso_token=`; //context.request.parameters.callback + '?sso_token=' || 

        // Log request details including the calling URL
        const requestUrl = context.request.url;
        const referer = context.request.headers['referer'] || context.request.headers['Referer'];
        const userAgent = context.request.headers['user-agent'] || context.request.headers['User-Agent'];
        const method = context.request.method;

        log.debug('Request Details', {
            url: requestUrl,
            method: method,
            referer: referer,
            userAgent: userAgent,
            parameters: JSON.stringify(context.request.parameters),
            headers: JSON.stringify(context.request.headers)
        });

        try {
            const user = runtime.getCurrentUser();
            log.debug('customer user', `${user.id} ${user.name} ${user.email} ${user.role} ${user.roleId}`);

            // Validate this is a customer user (basic validation)
            if (!user.entity) {
                throw new Error('User must have an associated entity (customer) record');
            }

            // Get customer information
            const customerInfo = getCustomerInfo(user);
            log.debug('customerInfo', JSON.stringify(customerInfo));

            const payload = createCustomerPayload(user, customerInfo);
            log.debug({ title: 'customer payload', details: JSON.stringify(payload) });

            const jwtToken = generateJwtToken(payload);
            const redirectUrl = `${REDIRECT_URL}${jwtToken}`;
            log.debug('customer redirectUrl', redirectUrl);
            redirect.redirect({ url: redirectUrl });
        } catch (error) {
            log.error('Customer SSO Error', error);
            log.error(error.message, error.stack ? error.stack.toString() : '');

            // Redirect to error page
            const errorUrl = `YOUR_REPLIT_DOMAIN/login?error=${encodeURIComponent('Customer authentication failed: ' + error.message)}`;
            redirect.redirect({ url: errorUrl });
        }
    }

    function getCustomerInfo(user) {
        try {
            if (!user.entity) {
                return { companyName: null, customerType: 'unknown' };
            }

            // Load customer record to get company name and details
            const customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: user.entity
            });

            const companyName = customerRecord.getValue({ fieldId: 'companyname' }) || customerRecord.getValue({ fieldId: 'entityid' }) || customerRecord.getValue({ fieldId: 'altname' });

            const customerType = customerRecord.getValue({ fieldId: 'category' }) || 'customer_center';

            log.debug('customer record loaded', `Company: ${companyName}, Type: ${customerType}`);

            return {
                companyName: companyName,
                customerType: customerType
            };
        } catch (e) {
            log.error('Error loading customer record', e.toString());
            return {
                companyName: user.name || 'Unknown Customer',
                customerType: 'customer_center'
            };
        }
    }

    function createCustomerPayload(user, customerInfo) {
        const currentTime = Math.round(Date.now() / 1000);
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            customerId: user.entity,
            entityId: user.entity,
            companyName: customerInfo.companyName,
            isCustomer: true,
            customerType: customerInfo.customerType,
            aud: AUDIENCE,
            iss: ISSUER,
            exp: currentTime + JWT_EXPIRATION_TIME,
            iat: currentTime
        };
    }

    function toBase64UrlSafe(str) {
        return encode
            .convert({
                string: str,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64_URL_SAFE
            })
            .replace(/=+$/, '');
    }

    function generateJwtToken(payload) {
        const header = toBase64UrlSafe(
            JSON.stringify({
                type: 'JWT',
                alg: 'HS256'
            })
        );

        const body = toBase64UrlSafe(JSON.stringify(payload));

        const secretKey = crypto.createSecretKey({
            secret: SECRET_ID,
            encoding: encode.Encoding.UTF_8
        });

        const signer = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });

        signer.update({
            input: `${header}.${body}`,
            inputEncoding: encode.Encoding.UTF_8
        });

        const signature = signer
            .digest({
                outputEncoding: encode.Encoding.BASE_64_URL_SAFE
            })
            .replace(/=+$/, '');

        log.audit('customer signature', signature);
        log.audit('customer jwt', `${header}.${body}.${signature}`);
        return `${header}.${body}.${signature}`;
    }

    return {
        onRequest: onRequest
    };
});

/**
 * @NApiVersion 2.1
 * @NScriptType SuiteLet
 */

define(['N/redirect', 'N/encode', 'N/crypto', 'N/runtime'], function (redirect, encode, crypto, runtime) {
    const JWT_EXPIRATION_TIME = 60; // JWT expiration time in seconds
    const AUDIENCE = 'replit.dev';
    const ISSUER = 'https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4389&deploy=1';
    const d = 'custsecret_portal_sso'; // Secret ID from secrets management page

    function onRequest(context) {
        const REDIRECT_URL = context.request.parameters.callback + '?sso_token=' || `http://localhost:5000/api/auth/netsuite/sso?sso_token=`;
        try {
            const user = runtime.getCurrentUser();
            log.debug('user', `${user.id} ${user.name} ${user.email}`);

            const fullName = getFullName(user.name);
            log.debug('userName', fullName);

            const payload = createPayload(user.id, fullName, user.email);
            log.debug({ title: 'payload', details: JSON.stringify(payload) });

            const jwtToken = generateJwtToken(payload);
            const redirectUrl = `${REDIRECT_URL}${jwtToken}`;
            log.debug('redirectUrl', redirectUrl);
            redirect.redirect({ url: redirectUrl });
        } catch (error) {
            log.error('Error', error);
            log.error(error.message, error.stack.toString());
        }
    }

    function getFullName(userName) {
        const userNameParts = userName.split(',');
        const firstNameParts = userNameParts[1].trim().split(' ');
        const lastNameParts = userNameParts[0].trim().split(' ');
        const empid = lastNameParts[0];
        const lastName = lastNameParts[1];
        const firstName = firstNameParts[0];
        const middleInitial = firstNameParts[1] ? firstNameParts[1] : '';
        return `${empid}_${firstName}_${middleInitial}_${lastName}`.trim();
    }

    function createPayload(userId, fullName, email) {
        const currentTime = Math.round(Date.now() / 1000);
        return {
            id: userId,
            name: fullName,
            email: email,
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
            secret: d,
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
        log.audit('signature', signature);
        log.audit('jwt', `${header}.${body}.${signature}`);
        return `${header}.${body}.${signature}`;
    }

    return {
        onRequest: onRequest
    };
});

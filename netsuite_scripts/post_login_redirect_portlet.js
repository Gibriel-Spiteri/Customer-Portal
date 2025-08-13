/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope Public
 * 
 * This portlet automatically redirects logged-in customers to the Replit app
 * Deploy this on the Customer Center home page
 */
define(['N/runtime', 'N/redirect', 'N/url', 'N/record'], function(runtime, redirect, url, record) {
    
    function render(params) {
        try {
            const user = runtime.getCurrentUser();
            const portlet = params.portlet;
            
            // Check if this is a customer user
            if (user.roleCenter === 'CUSTOMER' || user.role === 3) {
                
                // Get customer information
                let customerId = user.entity || user.id;
                let customerEmail = user.email;
                let customerName = user.name;
                let companyName = '';
                
                // Try to get company name from customer record
                try {
                    if (user.entity) {
                        const customerRecord = record.load({
                            type: record.Type.CUSTOMER,
                            id: user.entity
                        });
                        companyName = customerRecord.getValue('companyname') || 
                                     customerRecord.getValue('altname') || 
                                     customerRecord.getValue('entityid') || '';
                    }
                } catch (e) {
                    log.error('Error loading customer record', e.toString());
                }
                
                // Build redirect URL with customer data
                const replitUrl = 'https://2fdee256-490e-452c-b9d3-9acfca1ecfa0.worf.prod.repl.run';
                const redirectParams = new URLSearchParams({
                    customerId: customerId,
                    customerName: companyName || customerName,
                    email: customerEmail,
                    success: 'true',
                    source: 'netsuite_login'
                });
                
                const fullRedirectUrl = `${replitUrl}/auth/netsuite/enterprise-callback?${redirectParams.toString()}`;
                
                // Add auto-redirect script to portlet
                portlet.title = 'Redirecting to Customer Portal...';
                portlet.html = `
                    <div style="padding: 20px; text-align: center;">
                        <h3>Welcome ${customerName}!</h3>
                        <p>Redirecting you to the Customer Portal...</p>
                        <p>If you are not redirected automatically, <a href="${fullRedirectUrl}">click here</a>.</p>
                        <script>
                            // Redirect after a brief delay
                            setTimeout(function() {
                                window.top.location.href = '${fullRedirectUrl}';
                            }, 1000);
                        </script>
                    </div>
                `;
                
            } else {
                // Not a customer user
                portlet.title = 'Access Restricted';
                portlet.html = '<p>This portlet is only available for customer users.</p>';
            }
            
        } catch (error) {
            log.error('Portlet Error', error.toString());
            params.portlet.title = 'Error';
            params.portlet.html = '<p>An error occurred. Please contact support.</p>';
        }
    }
    
    return {
        render: render
    };
});
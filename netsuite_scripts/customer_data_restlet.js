/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/record', 'N/search'], function(runtime, record, search) {
    
    /**
     * Get current logged-in customer data
     */
    function get(requestParams) {
        try {
            var currentUser = runtime.getCurrentUser();
            
            // Check if user is logged in
            if (!currentUser || currentUser.id === -5) {
                return {
                    error: 'Not authenticated',
                    success: false
                };
            }
            
            // Get customer ID from current user
            var customerId = currentUser.id;
            var customerEmail = currentUser.email;
            var customerName = currentUser.name;
            
            // Load customer record for more details
            try {
                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerId
                });
                
                return {
                    success: true,
                    id: customerId,
                    email: customerEmail,
                    name: customerName,
                    companyname: customerRecord.getValue('companyname') || customerRecord.getValue('altname'),
                    entityid: customerRecord.getValue('entityid'),
                    firstname: customerRecord.getValue('firstname'),
                    lastname: customerRecord.getValue('lastname'),
                    phone: customerRecord.getValue('phone'),
                    subsidiary: customerRecord.getValue('subsidiary')
                };
            } catch (e) {
                // If can't load customer record, return basic info
                return {
                    success: true,
                    id: customerId,
                    email: customerEmail,
                    name: customerName
                };
            }
            
        } catch (e) {
            return {
                error: e.message,
                success: false
            };
        }
    }
    
    return {
        get: get
    };
});
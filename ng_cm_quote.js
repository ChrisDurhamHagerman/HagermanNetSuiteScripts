/**
 * @NApiVersion 2.1
 */
define(['N/record', 'N/https', 'N/ui/dialog','N/search','N/url','N/runtime'],
    (record, https, dialog, search,url,runtime) => {

        function getQuoteDetails(quoteNumber, internalid) {                
            if (isEmpty(quoteNumber)){
                dialog.alert({
                    title: 'Stopping Get Quote Details',
                    message: 'There is no Autodesk Quote # on this Netsuite quote.'
                }).then(success).catch(failure);
            }
            else{
                fetchQuoteDetails(quoteNumber, internalid); 
            }    
                            
        }

        function finalizeQuote(quoteNumber, internalid, finalizeDate) {   
            if (isEmpty(quoteNumber)){
                dialog.alert({
                    title: 'Stopping Finalize',
                    message: 'There is no Autodesk Quote # on this Netsuite quote.'
                }).then(success).catch(failure);
            }
            else if (finalizeDate){
                dialog.alert({
                    title: 'Stopping Finalize', 
                    message: 'This quote has already by Finalized'
                }).then(success).catch(failure);
            }
            else{
                dialog.confirm({
                    title: 'Finalize Confirmation',
                    message: 'Press OK to cause a quote to be sent from Autodesk to the customer, or Cancel this action.' 
                }).then(function(result) {
                    if (result) {
                        callFinalizeQuote(quoteNumber, internalid);
                    }
                }).catch(function(reason) {
                    log.debug('Confirmation', 'The user cancelled the confirmation');
                });                                
            }
        }

        function callFinalizeQuote(quoteNumber, internalid) {

            var urlDomain = url.resolveDomain({
                hostType: url.HostType.APPLICATION,
                accountId: runtime.accountId
            });

            console.log('Quote Number', quoteNumber);
            console.log('Internal ID', internalid);

            var params = {};
            params['action'] = 'finalize';
            params['quoteNumber'] = quoteNumber;
            params['internalid'] = internalid;

            console.log('Params', params);

            var scriptURL = url.resolveScript({
                scriptId: 'customscript_ng_sl_autodesk_tasks',
                deploymentId: 'customdeploy_ng_sl_autodesk_tasks',
                returnExternalUrl: false,
                params: params
            });

            console.log('Script URL:', scriptURL);

            var fullScriptURL = `https://${urlDomain}${scriptURL}`;

            console.log('Full Script URL:',fullScriptURL);

            var suiteletResponse = https.get({
                url: fullScriptURL
            });            

            //log.debug('Response', suiteletResponse);

            console.log(suiteletResponse);
            
            location.replace(location.href);
        }      

        function fetchQuoteDetails(quoteNumber, internalid) {
            var urlDomain = url.resolveDomain({
                hostType: url.HostType.APPLICATION,
                accountId: runtime.accountId
            });
        
            var params = {
                action: 'getDetails',
                quoteNumber: quoteNumber,
                internalid: internalid
            };
        
            var scriptURL = url.resolveScript({
                scriptId: 'customscript_ng_sl_autodesk_tasks',
                deploymentId: 'customdeploy_ng_sl_autodesk_tasks',
                returnExternalUrl: false,
                params: params
            });
        
            var fullScriptURL = `https://${urlDomain}${scriptURL}`;
            console.log('Full Script URL:', fullScriptURL);
        
            https.get.promise({ url: fullScriptURL })
                .then(function(response) {
                    console.log("Suitelet Response Body:", response.body);
                    
                    var responseData = JSON.parse(response.body);
                    console.log('Parsed Response Data:', responseData);
        
                    if (responseData.isGovernment) {
                        console.log("Government account detected. Prompting user.");
        
                        dialog.confirm({
                            title: "Government Account Warning",
                            message: responseData.message
                        }).then(function(result) {
                            if (result) {
                                console.log("User confirmed proceeding with Government account.");
                                fetchQuoteDetailsWithForce(quoteNumber, internalid);
                            } else {
                                console.log("User canceled operation.");
                            }
                        }).catch(function(error) {
                            console.error("Error showing confirmation dialog:", error);
                        });
                    } else {
                        console.log("Non-Government Account. Proceeding.");
                        location.replace(location.href);
                    }
                })
                .catch(function(error) {
                    console.error("Error fetching quote details:", error);
                });
        }
        
        
        // Function to refetch line items when user confirms government warning
        function fetchQuoteDetailsWithForce(quoteNumber, internalid) {
            
            var urlDomain = url.resolveDomain({
                hostType: url.HostType.APPLICATION,
                accountId: runtime.accountId
            });
        
            var params = {
                action: 'getDetails',
                quoteNumber: quoteNumber,
                internalid: internalid,
                proceed: true  // Added to differentiate second request
            };
        
            var scriptURL = url.resolveScript({
                scriptId: 'customscript_ng_sl_autodesk_tasks',
                deploymentId: 'customdeploy_ng_sl_autodesk_tasks',
                returnExternalUrl: false,
                params: params
            });
        
            console.log('Script URL:', scriptURL);
            var fullScriptURL = `https://${urlDomain}${scriptURL}`;
            console.log('Full Script URL:', fullScriptURL);
        
            https.get.promise({ url: fullScriptURL })
                .then(function(response) {
                    console.log("Proceeding with government account:", response.body);
                    location.replace(location.href);
                })
                .catch(function(error) {
                    console.error("Error fetching quote details after confirmation:", error);
                });
        }
        
        
        function isEmpty(value){

            if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (value.constructor === Object && Object.keys(value).length === 0)) {
        
                return true;
        
            } else {
        
                return false;
        
            }
        }

        return {
            getQuoteDetails: getQuoteDetails,
            finalizeQuote: finalizeQuote
        };
    });
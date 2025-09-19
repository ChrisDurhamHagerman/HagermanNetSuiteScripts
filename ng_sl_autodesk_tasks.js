/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/search','N/https','N/record','N/crypto','N/encode','N/ui/dialog', 'N/format'], function(search,https,record,crypto,encode,dialog,format) {

    const consumerKey = "1InXy1oxJJbZNxCsgg44lDYJkdeejZyx";
    const consumerSecret = "i1RgQeFweXJqemF6";
    const callbackUrl = "www.test.com";
    const environmentUrl = "enterprise-api.autodesk.com";
    const csn = "0070000545"
    const agentEmail = 'chrisdurham@hagerman.com';
    const mySecret = 'custsecret_hco_autodesk_api_26';
    const sKey = crypto.createSecretKey({
        secret: mySecret,
        encoding: encode.Encoding.UTF_8
    })

    function onRequest(context) {
       
        if (context.request.method === 'GET') {

            let params = context.request.parameters;

            let action = params.action;

            if(action == 'getDetails'){
                
                let quoteNumber = params.quoteNumber;
                log.debug('Quote Number',quoteNumber);

                let internalId = params.internalid;
                log.debug('Internal ID',internalId);

                var response = getQuoteDetails(quoteNumber, internalId, context);
                log.debug('Post-GetQuoteDetails', response.body);

                context.response.write(response);

                //let responseObj = {};
                //responseObj.success = true;
                //responseObj.message = 'Process completed successfully.';
                //context.response.write(JSON.stringify(responseObj))

            }else if(action == 'finalize'){

                let quoteNumber = params.quoteNumber;
                log.debug('Quote Number',quoteNumber);

                let internalId = params.internalid;
                log.debug('Internal ID',internalId);
                
                var response = finalizeQuote(quoteNumber, internalId);
                log.debug('Post-finalize', response.body);

                let responseObj = {};

                responseObj.success = true;

                responseObj.message = 'Process completed successfully.';

                context.response.write(JSON.stringify(responseObj))

            }            
           
            
        } else if (context.request.method === 'POST') {
            
            context.response.write({
                output: "Yay!! It's working (POST)"
            });
        } 
    }

    function getQuoteDetails(quoteNumber, internalId, context) {
        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;
        var isGovernment = false;
    
        var response = https.get({
            url: 'https://' + environmentUrl + '/v3/quotes?filter[quoteNumber]=' + quoteNumber,
            headers: headers
        });
    
        log.debug('Quote API Response', response.body);
    
        // Check if account is government
        isGovernment = getAccounts(response);
    
        log.debug('Determined Government Status', isGovernment);
    
        if (isGovernment && !context.request.parameters.proceed) {
            log.debug("Government account detected", "Returning warning message.");
            return JSON.stringify({
                isGovernment: true,
                message: "WARNING! Autodesk has identified the customer as a government entity. Please CANCEL this AGENCY quote unless you are certain it is ok to proceed. Then delete/cancel the quote in CPQ."  
                
            });
        }
    
        log.debug("Non-Government Account", "Proceeding to get line items.");
    
        // If not a government account, proceed normally
        var lineItemsResponse = getLineItems(response, internalId);
    
        log.debug("Line Items Response", lineItemsResponse);
    
        return JSON.stringify({
            isGovernment: false,
            data: lineItemsResponse
        });
    }
    

    function getAccounts(quoteResponse) {
        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;
    
        var quoteData = JSON.parse(quoteResponse.body);
        log.debug('Parsed Quote Response', quoteData);
    
        var partnerCSN = quoteData[0]?.endCustomer?.accountCsn;
        log.debug('Extracted partnerCSN', partnerCSN);
    
        var isGovernment = false;
    
        var response = https.get({
            url: 'https://' + environmentUrl + '/v1/accounts/' + partnerCSN,
            headers: headers
        });
    
        log.debug('Account API Response', response.body);
    
        var customerData = JSON.parse(response.body);
        log.debug('Parsed Customer Data', customerData);
    
        isGovernment = customerData?.type === "Government";
        log.debug('Final Determination of Government Status', isGovernment);
    
        return isGovernment;
    }

    function finalizeQuote(quoteNumber, internalId) {
        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;

        var payload = {
            quoteNumber: quoteNumber,
            agentAccount: {
                accountCsn: csn
            },
            agentContact: {
                email: agentEmail
            },
        };

        log.debug('Quote Number', quoteNumber); 
        log.debug('Internal ID', internalId); 

        var response = https.put({
            url: 'https://' + environmentUrl + '/v1/quotes/finalize',
            body: JSON.stringify(payload),
            headers: headers
        });

        //log.debug('Response from FinalizeQuote', response.body);
        //log.debug('Response Code', response.code);       
        

        if (response.code == 202){
            var currentDate = new Date();

            const quoteRecord = record.load({
                type: record.Type.ESTIMATE,
                id: internalId,
                isDynamic: true
            });                     

            quoteRecord.setValue({
                fieldId: 'custbody_hco_adesk_quote_finalized',
                value: currentDate               
            });

            const savedQuoteId = quoteRecord.save();
            log.debug('Quote Saved', 'Quote ID: ' + savedQuoteId);
        }

        return response;
    }

    function getLineItems(response, internalid) {
        // Parse the JSON response body
        var quoteData = JSON.parse(response.body);

        // Check if the quoteData has lineItems and it is an array
        if (Array.isArray(quoteData) && quoteData.length > 0 && quoteData[0].lineItems) {
           var lineItems = quoteData[0].lineItems;
          var itemDetails = [];

          // Iterate through each line item to extract details
         lineItems.forEach(function(item) {
             var itemDetail = {
                 offeringId: item.offeringId,
                 quantity: item.quantity,
                 unitSRP: item.pricing.unitSRP,
                 termCode: item.offer.term.code,
                 action: item.action,
                 termDescription: item.offer.term.description,
                 endUserPrice: item.pricing.endUserPrice,
                 extendedSRP: item.pricing.extendedSRP,
                 autodeskLineNumber: item.quoteLineNumber,
                 offeringName: item.offeringName,
                 subscriptionId: item.subscription && item.subscription.id ? item.subscription.id : null,
                 subEndDate: item.subscription && item.subscription.endDate ? item.subscription.endDate : null,
                 startDate: item.startDate,
                 endDate: item.endDate,
                 promotionDescription: item.promotionDescription,
                 specialProgramDiscountDescription: item.specialProgramDiscountDescription,
                 promotionEndDate: item.promotionEndDate
                };
                itemDetails.push(itemDetail);
          });

          updateQuoteWithLineItems(internalid, itemDetails) 
        } else {
           dialog.alert({
               title: 'No Line Items',
               message: 'No line items found in the response.'
          });
         }
    }

    function updateQuoteWithLineItems(internalid, lineItemsDetails) {
        try {
            var quoteRecord = record.load({
                type: record.Type.ESTIMATE, // For quotes, the record type is usually 'estimate'
                id: internalid,
                isDynamic: true
            });

            //log.debug('Quote Record', quoteRecord);

            //log.debug('Updating', lineItemsDetails);

            // Loop through each line item detail and add to the quote
            for (var i = 0;i<lineItemsDetails.length;i++) {
                
                itemDetail = lineItemsDetails[i];
                var rate = itemDetail.endUserPrice / itemDetail.quantity;
                rate = parseFloat(rate).toFixed(3);

                var vendorName = itemDetail.offeringId + '-' + itemDetail.termCode;
                var bonusType = 0;
                if(itemDetail.action == "Renewal" || itemDetail.action == "Extension" || itemDetail.action == "Switch"){
                    bonusType = 3; //"Renewal Subscription"
                }else{
                    bonusType = 1; //"Product"
                } 

                //log.debug('Bonus Type', bonusType);               

                let itemFilters = [                            
                    ["isinactive","is","F"], 
                    "AND", 
                    ["mpn","is",vendorName]
                ]
                

                let itemColumns = [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "itemid", label: "Name"}),
                    search.createColumn({name: "mpn", label: "Vendor Name"})
                ]
                    
                let itemResult = getSearchResults('item',itemFilters,itemColumns);
                if(itemResult.length == 0){
                    dialog.alert({
                        title: 'ALERT',
                        message: 'No item found with name: ' + vendorName
                    });
                }

                var startDateColumn = new Object();
                var endDateColumn = new Object();
                                            
                var description = itemDetail.offeringName + ' ' + itemDetail.termDescription + ' ' + itemDetail.action + ' ';
                
                if(itemDetail.subscriptionId){
                    var subIdDescription = '\nSubscription ID# ' + itemDetail.subscriptionId;
                    description = description + subIdDescription;
                    //log.debug('Description subIdDescription', subIdDescription);
                }                
                if(itemDetail.startDate){
                    var startDate = convertDate(itemDetail.startDate);
                    description = description + '\n' + startDate; 
                    startDateColumn = formatDate(itemDetail.startDate);
                    //log.debug('Description startDateDescription', description);
                }
                if(itemDetail.endDate){
                    var endDate = convertDate(itemDetail.endDate);
                    description = description + ' - ' + endDate;
                    endDateColumn = formatDate(itemDetail.endDate); 
                    //log.debug('Description endDateDescription', description);
                }
                if(itemDetail.specialProgramDiscountDescription){
                    var specialProgramDiscountDescriptionNew = '\n'  + itemDetail.specialProgramDiscountDescription;
                    description = description + specialProgramDiscountDescriptionNew; 
                    //log.debug('Description specialProgramDiscountDescriptionNew', description);
                }
                if(itemDetail.promotionDescription){
                    var promotionDescriptionNew = '\n'  + itemDetail.promotionDescription;
                    description = description + promotionDescriptionNew; 
                    //log.debug('Description promotionDescription', description);
                }
                if(itemDetail.promotionEndDate){
                    var promotionEndDateDescription = '\n(SPECIAL PRICING THAT ENDS ' + itemDetail.promotionEndDate + ')';
                    description = description + promotionEndDateDescription; 
                    //log.debug('Description promotionEndDate', description);
                }                     
                

                if(!isEmpty(itemResult) && itemResult.length > 0){
                        
                    let itemID = itemResult[0].getValue({name: 'internalid'});

                    quoteRecord.selectNewLine({ sublistId: 'item' });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemID });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: itemDetail.quantity });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'price', value: -1 });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: bonusType });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_ext_cust_price', value: itemDetail.endUserPrice });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_ext_srp', value: itemDetail.extendedSRP });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_adesk_line_num', value: itemDetail.autodeskLineNumber });
                    quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_unit_cust_price', value: rate });
                    if(itemDetail.startDate){
                        quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_adesk_start', value: startDateColumn });
                    }
                    if(itemDetail.endDate){
                        quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_adesk_end', value: endDateColumn });
                    }
                    quoteRecord.commitLine({ sublistId: 'item' });

                }
                else{
                    log.debug('Item not found', "Item Not Found")
                    throw {message: `Item Not Found - ${vendorName}`};
                }
                
            };

            log.debug('Before Update', "Here")

            // Save the quote record
            var savedRecordId = quoteRecord.save();
            dialog.alert({
                title: 'Success',
                message: 'Quote updated successfully with ID: ' + savedRecordId
            });
        } catch (error) {
            dialog.alert({
                title: 'Error updating quote',
                message: error.message
            });
        }
    }

    function isEmpty(value){

        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (value.constructor === Object && Object.keys(value).length === 0)) {
    
            return true;
    
        } else {
    
            return false;
    
        }
    }

    function getSearchResults(type,filters,columns){

        let mySearch = search.create({
            type: type,
            filters: filters,
            columns: columns
        });
    
        let results = [];
    
        let pages = mySearch.runPaged();
        pages.pageRanges.forEach(function(range) {
    
            let page = pages.fetch({ index : range.index });
    
            results = results.concat(page.data);
    
        });
    
        return results;
    
    }

    function getBasicAuthToken() {
        var concatCredentials = consumerKey + ':' + consumerSecret;        
        var encodedCredentials = encode.convert({
            string: concatCredentials,
            inputEncoding: encode.Encoding.UTF_8,
            outputEncoding: encode.Encoding.BASE_64
        });
        return "Basic " + encodedCredentials;
    }

    function createSignature(message) {
        try {          
            
            var hmacSha256 = crypto.createHmac({
                algorithm: crypto.HashAlg.SHA256,
                key: sKey
            });

            //log.debug('HMAC object created', hmacSha256);

            hmacSha256.update({
                input: message,
                inputEncoding: encode.Encoding.UTF_8
            });

            //log.debug('HMAC object updated', hmacSha256);
            
            var signature = hmacSha256.digest({
                outputEncoding: encode.Encoding.BASE_64
            })

            //log.debug('Signature', signature);
            return signature;

        } catch (e) {
            log.error('Error in createSignature', e.message);
            throw e;
        }
    }

    function getAccessToken() {
        var timestamp = Math.floor(Date.now() / 1000).toString();
        var message = callbackUrl + consumerKey + timestamp;
        var signature = createSignature(message);
        var authToken = getBasicAuthToken();

        var response = https.post({
            url: 'https://' + environmentUrl + '/v2/oauth/generateaccesstoken?grant_type=client_credentials',
            headers: {
                'Authorization': authToken,
                'Signature': signature,
                'Timestamp': timestamp,
                'Content-Type': 'application/json'
            }
        });

        if (response.code === 200) {
            var body = JSON.parse(response.body);
            //log.debug('Access Token', body.access_token);
            return body.access_token;
        } else {
            throw new Error('Failed to retrieve access token: ' + response.body);
        }
    }

    function createAuthenticatedHeaders(accessToken) {
        var timestamp = Math.floor(Date.now() / 1000).toString();
        var message = callbackUrl + accessToken + timestamp;
        var signature = createSignature(message);
        return {
            'Authorization': 'Bearer ' + accessToken,
            'Signature': signature,
            'Timestamp': timestamp,
            'Content-Type': 'application/json'
        };
    }

    function convertDate(dateString) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateParts = dateString.split('-');
        const year = dateParts[0];
        const month = parseInt(dateParts[1], 10) - 1; // Subtract 1 because months are zero-indexed
        const day = parseInt(dateParts[2], 10);
    
        return `${months[month]} ${day}, ${year}`;
    }

    function formatDate(inputDate) {
        var dateParts = inputDate.split("-");
        var year = parseInt(dateParts[0], 10);
        var month = parseInt(dateParts[1], 10) - 1;
        var day = parseInt(dateParts[2], 10);
        var dateObject = new Date(year, month, day);
        //log.debug('Format Date Object', dateObject);

        return dateObject;
    }   

    return {
        onRequest: onRequest
    };

});
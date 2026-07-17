/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/search','N/https','N/record','N/crypto','N/encode','N/ui/dialog', 'N/format'], function(search,https,record,crypto,encode,dialog,format) {

    const consumerKey = "VfqFUv1FAYFfwY9AuSh45w0uS8ue9VlEHV8MOaBU6HHNrHGf"; 
    const consumerSecret = "5Ga80A5nwkxROrFmKOCGjcMtAGpYZrHoO9GU1ZRKLl6I4KVgjDF1CuiDm9dKgMyl";
    const callbackUrl = "www.test.com";
    const environmentUrl = "enterprise-api-stg.autodesk.com";
    const csn = "0070000545"
    const agentEmail = 'chrisdurham@hagerman.com';
    const mySecret = 'custsecret_hco_autodesk_api_26';
    const sKey = crypto.createSecretKey({
        secret: mySecret,
        encoding: encode.Encoding.UTF_8
    });

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

            }else if(action == 'getOpportunityDetails'){

                let opportunityNumber = params.opportunityNumber;
                log.debug('Opportunity Number', opportunityNumber);

                let internalId = params.internalid;
                log.debug('Internal ID', internalId);

                try {
                    var renewalResponse = getOpportunityDetails(opportunityNumber, internalId);
                    context.response.write(JSON.stringify(renewalResponse));
                } catch (e) {
                    log.error('Get Opportunity Details Error', e);
                    context.response.write(JSON.stringify({
                        success: false,
                        message: e.message
                    }));
                }

            }else if(action == 'createQuoteFromOpportunity'){

                let opportunityNumber = params.opportunityNumber;
                log.debug('Opportunity Number', opportunityNumber);

                let internalId = params.internalid;
                log.debug('Internal ID', internalId);

                try {
                    var renewalQuoteResponse = createQuoteFromOpportunity(opportunityNumber, internalId);
                    context.response.write(JSON.stringify(renewalQuoteResponse));
                } catch (e) {
                    log.error('Create Quote From Opportunity Error', e);
                    context.response.write(JSON.stringify({
                        success: false,
                        message: e.message
                    }));
                }

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

    function getOpportunityDetails(opportunityNumber, internalId) {
        log.debug('Starting GetOpportunityDetails', {
            opportunityNumber: opportunityNumber,
            internalId: internalId,
            partnerCsn: csn
        });

        var opportunityDetail = fetchOpportunityDetail(opportunityNumber);
        var lineItemsResponse = getOpportunityLineItems(opportunityDetail, internalId, opportunityNumber);

        return {
            success: true,
            data: lineItemsResponse
        };
    }

    function createQuoteFromOpportunity(opportunityNumber, internalId) {
        log.debug('Starting CreateQuoteFromOpportunity', {
            opportunityNumber: opportunityNumber,
            internalId: internalId,
            partnerCsn: csn
        });

        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;

        var opportunityDetail = fetchOpportunityDetail(opportunityNumber);
        var payload = buildAsIsRenewalPayload(opportunityNumber, opportunityDetail, internalId);
        log.debug('Create Quote Payload', JSON.stringify(payload));

        var response = https.post({
            url: 'https://' + environmentUrl + '/v3/quotes',
            body: JSON.stringify(payload),
            headers: headers
        });

        log.debug('Create Quote Response Code', response.code);
        log.debug('Create Quote Response Body', response.body);

        if (response.code !== 200 && response.code !== 201 && response.code !== 202) {
            throw new Error('Failed to create Autodesk quote from opportunity: ' + response.body);
        }

        var quoteNumber = extractQuoteNumber(response.body);
        if (!quoteNumber) {
            var parsedCreateResponse = JSON.parse(response.body);
            if (response.code === 202 && parsedCreateResponse.message === 'success') {
                if (parsedCreateResponse.transactionId) {
                    saveAutodeskTransactionId(internalId, parsedCreateResponse.transactionId);
                }

                return {
                    success: false,
                    accepted: true,
                    transactionId: parsedCreateResponse.transactionId || null,
                    message: 'Autodesk accepted the create quote request, but did not return a quote number yet.'
                };
            }

            throw new Error('Autodesk create quote response did not include a quote number.');
        }

        saveAutodeskQuoteNumber(internalId, quoteNumber);

        var quoteResponse = getQuoteDetails(quoteNumber, internalId, {
            request: {
                parameters: {}
            }
        });

        var parsedQuoteResponse = JSON.parse(quoteResponse);

        return {
            success: true,
            quoteNumber: quoteNumber,
            data: parsedQuoteResponse.data
        };
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

    function getOpportunityLineItems(opportunityDetail, internalid, opportunityNumber) {
        log.debug('Processing Opportunity Detail', {
            opportunityNumber: opportunityNumber,
            internalId: internalid,
            responseOpportunityNumber: opportunityDetail.opportunity_number,
            lineItemCount: opportunityDetail.line_items ? opportunityDetail.line_items.length : 0
        });

        if (opportunityDetail.line_items && Array.isArray(opportunityDetail.line_items) && opportunityDetail.line_items.length > 0) {
            var itemDetails = [];

            opportunityDetail.line_items.forEach(function(item, index) {
                log.debug('Raw Opportunity Line Item', {
                    lineNumber: index + 1,
                    renewalSku: item.renewal_sku,
                    quantity: item.quantity,
                    serialNumber: item.serial_number,
                    status: item.status,
                    renew: item.renew
                });

                itemDetails.push({
                    renewalSku: item.renewal_sku,
                    skuDescription: item.sku_description,
                    quantity: item.quantity,
                    seats: item.seats,
                    renewedQuantity: item.renewed_quantity,
                    deployment: item.deployment,
                    status: item.status,
                    assetStatus: item.asset_status,
                    supportProgram: item.support_program,
                    programEligibility: item.program_eligibility,
                    renew: item.renew,
                    serialNumber: item.serial_number,
                    subscriptionEndDate: opportunityDetail.subscription_end_date,
                    contractTerm: opportunityDetail.contract ? opportunityDetail.contract.contract_term : null,
                    contractDuration: opportunityDetail.contract ? opportunityDetail.contract.contract_duration : null,
                    contractNumber: opportunityDetail.contract ? opportunityDetail.contract.contract_number : null,
                    renewOnlineEligibility: opportunityDetail.renew_online_eligibility,
                    opportunityNumber: opportunityDetail.opportunity_number || opportunityNumber,
                    lineNumber: index + 1
                });
            });

            updateQuoteWithOpportunityLineItems(internalid, itemDetails);
            return itemDetails;
        }

        throw new Error('No renewal line items were returned for Autodesk opportunity ID ' + opportunityNumber + '.');
    }

    function fetchOpportunityDetail(opportunityNumber) {
        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;

        var response = https.get({
            url: 'https://' + environmentUrl + '/v2/opportunities?partnerCsn=' + encodeURIComponent(csn) + '&opportunityNumber=' + encodeURIComponent(opportunityNumber),
            headers: headers
        });

        log.debug('Opportunity API Response', response.body);
        log.debug('Opportunity API Response Code', response.code);

        if (response.code !== 200) {
            throw new Error('Failed to retrieve Autodesk renewal opportunity: ' + response.body);
        }

        var parsedResponse = JSON.parse(response.body);
        log.debug('Parsed Opportunity Response', parsedResponse);

        if (parsedResponse.status && parsedResponse.status !== 'OK') {
            var errorMessage = parsedResponse.error && parsedResponse.error.message ? parsedResponse.error.message : 'Unknown Autodesk opportunity error.';
            throw new Error(errorMessage);
        }

        if (!Array.isArray(parsedResponse.results) || parsedResponse.results.length === 0) {
            throw new Error('No Autodesk opportunity was found for opportunity ID ' + opportunityNumber + '.');
        }

        return parsedResponse.results[0];
    }

    function buildAsIsRenewalPayload(opportunityNumber, opportunityDetail, internalId) {
        var endCustomerAccount = opportunityDetail.endCustomer && opportunityDetail.endCustomer.account
            ? opportunityDetail.endCustomer.account
            : {};
        var purchaser = opportunityDetail.endCustomer && opportunityDetail.endCustomer.purchaser
            ? opportunityDetail.endCustomer.purchaser
            : {};
        var preparedByEmail = getPreparedByEmail(internalId);

        var quoteContact = {
            firstName: purchaser.firstName || 'Renewal',
            lastName: purchaser.lastName || 'Contact',
            email: purchaser.email || agentEmail,
            preferredLanguage: derivePreferredLanguage(endCustomerAccount.countryCode, endCustomerAccount.country)
        };

        if (endCustomerAccount.phone) {
            quoteContact.phone = endCustomerAccount.phone;
        }

        // Keep the opportunity-to-quote flow isolated from the existing quote-details import.
        return {
            opportunityNumber: opportunityNumber,
            currency: opportunityDetail.opportunityCurrency || 'USD',
            endCustomer: {
                accountCsn: endCustomerAccount.csn,
                name: endCustomerAccount.name,
                addressLine1: endCustomerAccount.addressLine1,
                addressLine2: endCustomerAccount.addressLine2,
                addressLine3: endCustomerAccount.addressLine3,
                city: endCustomerAccount.city,
                countryCode: endCustomerAccount.countryCode,
                postalCode: endCustomerAccount.postal
            },
            quoteContact: quoteContact,
            agentAccount: {
                accountCsn: csn
            },
            agentContact: {
                email: preparedByEmail
            }
        };
    }

    function getPreparedByEmail(internalId) {
        var quoteRecord = record.load({
            type: record.Type.ESTIMATE,
            id: internalId,
            isDynamic: false
        });

        var preparedById = quoteRecord.getValue({
            fieldId: 'custbody_hco_prepared_by'
        });

        log.debug('Prepared By Employee', {
            internalId: internalId,
            preparedById: preparedById
        });

        if (!preparedById) {
            throw new Error('Prepared By is required on the quote before Get Renewal can create the Autodesk quote.');
        }

        var employeeFields = search.lookupFields({
            type: search.Type.EMPLOYEE,
            id: preparedById,
            columns: ['email']
        });

        log.debug('Prepared By Email Lookup', employeeFields);

        if (!employeeFields.email) {
            throw new Error('The Prepared By employee does not have an email address in NetSuite.');
        }

        return employeeFields.email;
    }

    function extractQuoteNumber(responseBody) {
        var parsedBody = JSON.parse(responseBody);
        log.debug('Parsed Create Quote Response', parsedBody);

        if (parsedBody.quoteNumber) {
            return parsedBody.quoteNumber;
        }

        if (parsedBody.quote && parsedBody.quote.quoteNumber) {
            return parsedBody.quote.quoteNumber;
        }

        if (Array.isArray(parsedBody) && parsedBody.length > 0 && parsedBody[0].quoteNumber) {
            return parsedBody[0].quoteNumber;
        }

        if (parsedBody.data && parsedBody.data.quoteNumber) {
            return parsedBody.data.quoteNumber;
        }

        return null;
    }

    function saveAutodeskQuoteNumber(internalId, quoteNumber) {
        log.debug('Saving Autodesk Quote Number To NetSuite Quote', {
            internalId: internalId,
            quoteNumber: quoteNumber
        });

        var quoteRecord = record.load({
            type: record.Type.ESTIMATE,
            id: internalId,
            isDynamic: true
        });

        quoteRecord.setValue({
            fieldId: 'custbody_hco_adesk_quote_num',
            value: quoteNumber
        });

        var savedId = quoteRecord.save();
        log.debug('Autodesk Quote Number Saved', {
            internalId: internalId,
            savedId: savedId,
            quoteNumber: quoteNumber
        });
    }

    function saveAutodeskTransactionId(internalId, transactionId) {
        log.debug('Saving Autodesk Transaction ID To NetSuite Quote', {
            internalId: internalId,
            transactionId: transactionId
        });

        var quoteRecord = record.load({
            type: record.Type.ESTIMATE,
            id: internalId,
            isDynamic: true
        });

        quoteRecord.setValue({
            fieldId: 'custbody_hco_adesk_transaction_id',
            value: transactionId
        });

        var savedId = quoteRecord.save();
        log.debug('Autodesk Transaction ID Saved', {
            internalId: internalId,
            savedId: savedId,
            transactionId: transactionId
        });
    }

    function derivePreferredLanguage(countryCode, countryName) {
        var normalizedCountryCode = countryCode ? countryCode.toUpperCase() : '';
        var normalizedCountryName = countryName ? countryName.toLowerCase() : '';

        if (normalizedCountryCode === 'US' || normalizedCountryName === 'united states') {
            return 'en';
        }

        if (normalizedCountryCode === 'AU' || normalizedCountryName === 'australia') {
            return 'en';
        }

        if (normalizedCountryCode === 'GB' || normalizedCountryName === 'united kingdom') {
            return 'en';
        }

        return 'en';
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

    function updateQuoteWithOpportunityLineItems(internalid, lineItemsDetails) {
        try {
            log.debug('Updating Quote With Opportunity Line Items', {
                internalId: internalid,
                lineCount: lineItemsDetails.length
            });

            var quoteRecord = record.load({
                type: record.Type.ESTIMATE,
                id: internalid,
                isDynamic: true
            });

            for (var i = 0; i < lineItemsDetails.length; i++) {
                var itemDetail = lineItemsDetails[i];

                if (!itemDetail.renewalSku) {
                    throw {message: 'Renewal SKU is missing for one or more Autodesk opportunity lines.'};
                }

                var itemFilters = [
                    ["isinactive", "is", "F"],
                    "AND",
                    ["mpn", "is", itemDetail.renewalSku]
                ];

                var itemColumns = [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "itemid", label: "Name"}),
                    search.createColumn({name: "mpn", label: "Vendor Name"})
                ];

                var itemResult = getSearchResults('item', itemFilters, itemColumns);
                log.debug('Renewal Item Search Result Count', {
                    renewalSku: itemDetail.renewalSku,
                    resultCount: itemResult.length
                });

                if (itemResult.length === 0) {
                    throw {message: 'Item Not Found - ' + itemDetail.renewalSku};
                }

                var descriptionParts = [];
                descriptionParts.push(itemDetail.skuDescription || itemDetail.renewalSku);

                if (itemDetail.serialNumber) {
                    descriptionParts.push('Serial Number# ' + itemDetail.serialNumber);
                }

                if (itemDetail.contractNumber) {
                    descriptionParts.push('Contract# ' + itemDetail.contractNumber);
                }

                if (itemDetail.contractTerm || itemDetail.contractDuration) {
                    descriptionParts.push([itemDetail.contractTerm, itemDetail.contractDuration].filter(Boolean).join(' - '));
                }

                if (itemDetail.subscriptionEndDate) {
                    descriptionParts.push('Subscription End Date: ' + itemDetail.subscriptionEndDate);
                }

                if (itemDetail.supportProgram) {
                    descriptionParts.push('Support Program: ' + itemDetail.supportProgram);
                }

                if (itemDetail.deployment) {
                    descriptionParts.push('Deployment: ' + itemDetail.deployment);
                }

                if (itemDetail.status) {
                    descriptionParts.push('Status: ' + itemDetail.status);
                }

                if (itemDetail.assetStatus) {
                    descriptionParts.push('Asset Status: ' + itemDetail.assetStatus);
                }

                descriptionParts.push('NAD Eligible: ' + (itemDetail.programEligibility ? 'Yes' : 'No'));
                descriptionParts.push('Renew Online Eligible: ' + (itemDetail.renewOnlineEligibility ? 'Yes' : 'No'));
                descriptionParts.push('Renew: ' + (itemDetail.renew ? 'Yes' : 'No'));
                descriptionParts.push('Autodesk Opportunity ID: ' + itemDetail.opportunityNumber);

                var description = descriptionParts.join('\n');
                var bonusType = 3;
                var itemID = itemResult[0].getValue({name: 'internalid'});

                log.debug('Adding Renewal Line To Quote', {
                    quoteId: internalid,
                    renewalSku: itemDetail.renewalSku,
                    itemId: itemID,
                    quantity: itemDetail.quantity,
                    lineNumber: itemDetail.lineNumber
                });

                quoteRecord.selectNewLine({ sublistId: 'item' });
                quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemID });
                quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: itemDetail.quantity });
                quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
                quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: bonusType });
                quoteRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_hco_adesk_line_num', value: itemDetail.lineNumber });
                quoteRecord.commitLine({ sublistId: 'item' });
            }

            var savedRecordId = quoteRecord.save();
            log.debug('Renewal Quote Saved', {
                quoteId: savedRecordId,
                sourceQuoteId: internalid,
                importedLineCount: lineItemsDetails.length
            });
            dialog.alert({
                title: 'Success',
                message: 'Quote updated successfully with renewal items. Quote ID: ' + savedRecordId
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



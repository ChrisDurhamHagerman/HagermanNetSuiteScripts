/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/email', 'N/log', 'N/https', 'N/crypto', 'N/encode','N/ui/dialog', 'N/format', 'N/url', 'N/runtime'], function(record, search, email, log, https, crypto, encode, dialog, format, url, runtime) { 

    const consumerKey = "VfqFUv1FAYFfwY9AuSh45w0uS8ue9VlEHV8MOaBU6HHNrHGf"; 
    const consumerSecret = "5Ga80A5nwkxROrFmKOCGjcMtAGpYZrHoO9GU1ZRKLl6I4KVgjDF1CuiDm9dKgMyl";
    const callbackUrl = "www.test.com";
    const environmentUrl = "enterprise-api.autodesk.com";
    const csn = "0070000545"
    const agentEmail = 'chrisdurham@hagerman.com';
    const mySecret = 'custsecret_hco_autodesk_api_26';
    const sKey = crypto.createSecretKey({
        secret: mySecret,
        encoding: encode.Encoding.UTF_8
    })
    var recordHasChanged = false;
    var retryCount = 0;

    const onRequest = (scriptContext) => {
        if (scriptContext.request.method === 'GET') {
            log.debug('GET - Yay It\'s Working!!!');
            scriptContext.response.write({ output: 'GET - Yay...It\'s Working!!!' });
        } else if (scriptContext.request.method === 'POST') {
            log.debug('POST - Yay It\'s Working!!!', scriptContext.request.body);
            do {
                try {
                    const requestBody = JSON.parse(scriptContext.request.body);
                    const payload = requestBody.payload;

                    if (requestBody.topic === 'quote-status' && requestBody.event === 'changed') {
                        const quoteNumber = payload.quoteNumber;
                        const transactionId = payload.transactionId;
                        const quoteStatus = payload.quoteStatus;
                        const message = payload.message;
                        const modifiedAt = payload.modifiedAt;
                        const quoteErrors = payload.errors || [];

                        log.debug('Quote Number', quoteNumber);
                        log.debug('Transaction ID', transactionId);
                        log.debug('Quote Status', quoteStatus);
                                                

                        log.debug('Message', message);
                        log.debug('Quote Errors', JSON.stringify(quoteErrors));

                        let quoteId = findQuoteId(quoteNumber, transactionId);

                        log.audit('Modified At', modifiedAt);
                        log.debug('QuoteId', quoteId)

                        if (quoteId) {
                            // Load the quote record
                            const quoteRecord = record.load({
                                type: record.Type.ESTIMATE,
                                id: quoteId,
                                isDynamic: true
                            });

                            // Update the quote status field
                            quoteRecord.setValue({
                                fieldId: 'custbody_hco_adesk_quote_status',
                                value: quoteStatus
                            });

                            if (transactionId) {
                                quoteRecord.setValue({
                                    fieldId: 'custbody_hco_adesk_transaction_id',
                                    value: transactionId
                                });
                            }

                            if (quoteNumber && quoteNumber !== 'NA') {
                                quoteRecord.setValue({
                                    fieldId: 'custbody_hco_adesk_quote_num',
                                    value: quoteNumber
                                });
                            }

                            if (quoteStatus == 'Quoted') {
                                var quoteDetails = getQuoteDetails(quoteNumber);
                                var quoteData = JSON.parse(quoteDetails.body);
                                log.debug('Quote Data', quoteData);

                                var quoteExpiration = quoteData[0].quoteExpirationDate;                        
                                log.debug('Quote Expiration', quoteExpiration);

                                var expiredDate = formatDate(quoteExpiration);
                                log.debug('Quote Expiration Format', expiredDate);

                                quoteRecord.setValue({
                                    fieldId: 'custbody_hco_adesk_quote_expires',
                                    value: expiredDate
                                });
                            }

                            // Save the quote record
                            const savedQuoteId = quoteRecord.save();
                            log.debug('Quote Saved', 'Quote ID: ' + savedQuoteId);

                            if (quoteStatus == 'Quoted' && quoteNumber && quoteNumber !== 'NA') {
                                triggerQuoteImport(quoteNumber, quoteId);
                            }

                            // Log the message and modifiedAt
                            log.audit('Quote Update', 'Message: ' + message + ', Modified At: ' + modifiedAt);

                            //Send email notification
                            // const recipients = ['davidhagerman@hagerman.com', 'chrisdurham@hagerman.com'];
                            // email.send({
                            //     author: 252453, // Use -5 for default sender
                            //     recipients: 'chrisdurham@hagerman.com', // Replace with actual recipient
                            //     subject: 'Quote Status Updated',
                            //     body: `The status of quote ${quoteNumber} has been updated to ${quoteStatus}.\n\nMessage: ${message}\nModified At: ${modifiedAt}`
                            // });

                            // log.debug('Email Recipients', recipients);

                            scriptContext.response.write({ output: 'POST - Quote updated successfully.' });
                            recordHasChanged = false;
                        } else {
                            log.error('Quote Not Found', 'Quote number ' + quoteNumber + ' not found.');
                            scriptContext.response.write({ output: 'POST - Quote not found.' });
                        }
                    }
                    else if (requestBody.topic === 'subscription-change') {
                        const subscriptionId = payload.subscriptionId;
                        const hasSubscriptionStatus = Object.prototype.hasOwnProperty.call(payload, 'status');
                        const hasCancelAtRenewal = Object.prototype.hasOwnProperty.call(payload, 'cancelAtRenewal');
                        const hasCancellationReason = Object.prototype.hasOwnProperty.call(payload, 'cancellationReason');
                        const subscriptionStatus = payload.status;

                        const subscriptionChangeLog = {
                            webhookId: requestBody.id,
                            event: requestBody.event,
                            subscriptionId: subscriptionId,
                            message: payload.message,
                            modifiedAt: payload.modifiedAt,
                            publishedAt: requestBody.publishedAt
                        };

                        if (hasSubscriptionStatus) {
                            subscriptionChangeLog.status = subscriptionStatus;
                        }

                        if (hasCancelAtRenewal) {
                            subscriptionChangeLog.cancelAtRenewal = payload.cancelAtRenewal;
                        }

                        if (hasCancellationReason) {
                            subscriptionChangeLog.cancellationReason = payload.cancellationReason;
                        }

                        log.audit('Subscription Webhook Received', JSON.stringify(subscriptionChangeLog));

                        if (!hasSubscriptionStatus || !subscriptionStatus) {
                            log.audit(
                                'Subscription Change Logged - No Status Update',
                                `Subscription ID: ${subscriptionId}, Event: ${requestBody.event}, Message: ${payload.message || ''}`
                            );
                            scriptContext.response.write({ output: `Subscription change logged for ${subscriptionId}; no status update required.` });
                            return;
                        }
                    
                        log.audit('Subscription Change Received', `Subscription ID: ${subscriptionId}, Status: ${subscriptionStatus}`);
                    
                        const salesOrderSearch = search.create({
                            type: search.Type.TRANSACTION,
                            filters: [
                                ['type', 'anyof', 'SalesOrd'],
                                'AND',
                                ['mainline', 'is', 'F'],
                                'AND',
                                ['custcol_hco_autodesk_subscription_id', 'is', subscriptionId]
                            ],
                            columns: [
                                search.createColumn({
                                    name: 'internalid',
                                    sort: search.Sort.DESC
                                })
                            ]
                        });
                    
                        log.debug('Searching for subscriptionId', JSON.stringify(subscriptionId));
                    
                        const results = salesOrderSearch.run().getRange({ start: 0, end: 1 });
                    
                        if (!results || results.length === 0) {
                            log.audit('No Matching Sales Orders', `No sales orders found for Subscription ID: ${subscriptionId}`);
                            scriptContext.response.write({ output: 'No matching sales orders found for subscription.' });
                            return;
                        }
                    
                        const salesOrderId = results[0].getValue({ name: 'internalid' });
                    
                        const so = record.load({
                            type: record.Type.SALES_ORDER,
                            id: salesOrderId,
                            isDynamic: true
                        });
                    
                        const lineCount = so.getLineCount({ sublistId: 'item' });
                        let updated = false;
                    
                        for (let i = 0; i < lineCount; i++) {
                            so.selectLine({ sublistId: 'item', line: i });
                    
                            const lineSubId = so.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_hco_autodesk_subscription_id'
                            });
                    
                            if (lineSubId === subscriptionId) {
                                so.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_hco_autodesk_sub_status',
                                    value: subscriptionStatus
                                });
                    
                                so.commitLine({ sublistId: 'item' });
                                updated = true;
                            }
                        }
                    
                        if (updated) {
                            const savedId = so.save();
                            log.audit('Updated Sales Order', `ID: ${savedId} updated with new subscription status.`);
                            scriptContext.response.write({ output: `Updated latest sales order (${savedId}) with subscription status.` });
                        } else {
                            log.audit('No Matching Lines', `Sales Order ${salesOrderId} had no matching lines for subscription ${subscriptionId}`);
                            scriptContext.response.write({ output: 'No matching lines found on latest sales order.' });
                        }
                    }

                    else {
                        log.audit('Unhandled Webhook Topic', JSON.stringify({
                            webhookId: requestBody.id,
                            topic: requestBody.topic,
                            event: requestBody.event
                        }));
                        scriptContext.response.write({ output: `POST - Webhook topic ${requestBody.topic || 'unknown'} is not handled.` });
                        recordHasChanged = false;
                    }
                }
                    
                    
                    
             //   } 
                catch (e) {
                    recordHasChanged = e.name === "RCRD_HAS_BEEN_CHANGED";
                    systemUsage = e.name === "SSS_USAGE_LIMIT_EXCEEDED";
                    if (recordHasChanged || systemUsage) {
                        log.audit('Record Not Saved', 'Attempt ' + ++retryCount);
                    }
                    if (!recordHasChanged || !systemUsage || retryCount >= 50) {
                        log.error('Error processing request', e);
                        scriptContext.response.write({ output: 'POST - Error processing request: ' + e.message });
                    }
                }
            } while (recordHasChanged && retryCount < 50)
        }
    };

    function getQuoteDetails(quoteNumber) {
        var accessToken = getAccessToken();
        var headers = createAuthenticatedHeaders(accessToken);
        headers['CSN'] = csn;

        var response = https.get({
            url: 'https://' + environmentUrl + '/v3/quotes?filter[quoteNumber]=' + quoteNumber,
            headers: headers
        });

        //log.debug('Response', response)

        return response;
    }

    function findQuoteId(quoteNumber, transactionId) {
        let quoteId;
        if (quoteNumber && quoteNumber !== 'NA') {
            quoteId = searchQuoteId([
                ['custbody_hco_adesk_quote_num', 'is', quoteNumber]
            ]);
        }

        if (!quoteId && transactionId) {
            quoteId = searchQuoteId([
                ['custbody_hco_adesk_transaction_id', 'is', transactionId]
            ]);
        }

        return quoteId;
    }

    function searchQuoteId(filters) {
        const quoteSearch = search.create({
            type: search.Type.ESTIMATE,
            filters: filters,
            columns: ['internalid']
        });

        let quoteId;
        quoteSearch.run().each(function(result) {
            quoteId = result.getValue('internalid');
            return false;
        });

        return quoteId;
    }

    function triggerQuoteImport(quoteNumber, internalId) {
        var urlDomain = url.resolveDomain({
            hostType: url.HostType.APPLICATION,
            accountId: runtime.accountId
        });

        var params = {
            action: 'getDetails',
            quoteNumber: quoteNumber,
            internalid: internalId,
            proceed: true
        };

        var scriptURL = url.resolveScript({
            scriptId: 'customscript_ng_sl_autodesk_tasks',
            deploymentId: 'customdeploy_ng_sl_autodesk_tasks',
            returnExternalUrl: false,
            params: params
        });

        var fullScriptURL = 'https://' + urlDomain + scriptURL;
        log.debug('Trigger Quote Import URL', fullScriptURL);

        var importResponse = https.get({
            url: fullScriptURL
        });

        log.debug('Trigger Quote Import Response', importResponse.body);
    }

    function getSubscriptionStatus(subscriptionId) {
        var accessToken = getAccessToken(); 
        var headers = createAuthenticatedHeaders(accessToken); 
        headers['CSN'] = csn; 
    
        var response = https.get({
            url: 'https://' + environmentUrl + '/v1/subscriptions-status?subscriptionId=' + subscriptionId,
            headers: headers
        });
    
        return response;
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

    function formatDate(inputDate) {
        var dateParts = inputDate.split("-");
        var year = parseInt(dateParts[0], 10);
        var month = parseInt(dateParts[1], 10) - 1;
        var day = parseInt(dateParts[2], 10);
        var dateObject = new Date(year, month, day);
        log.debug('Format Date Object', dateObject);

        return dateObject;
    } 

    return { onRequest };
});

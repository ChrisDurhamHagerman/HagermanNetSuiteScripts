/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime'],
    
    (record, runtime) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

                if(scriptContext.type == 'view'){

                        let quoteRec = scriptContext.newRecord;

                        let quoteNumber = quoteRec.getValue({
                            fieldId: 'custbody_hco_adesk_quote_num'
                        });

                        let opportunityNumber = quoteRec.getValue({
                            fieldId: 'custbody_hco_opportunity_id'
                        }) || '';

                        let preparedBy = quoteRec.getValue({
                            fieldId: 'custbody_hco_prepared_by'
                        });

                        let finalizeDate = quoteRec.getValue({
                            fieldId: 'custbody_hco_adesk_quote_finalized'
                        });

                        let internalid = quoteRec.id;

                        let proceed = false;

                        log.debug({title: 'Quote Number', details: quoteNumber});
                        log.debug({title: 'Autodesk Opportunity Number', details: opportunityNumber});
                        log.debug({title: 'Transaction ID', details: internalid});
                        log.debug({title: 'Prepared By', details: preparedBy});

                        let form = scriptContext.form;
                        let userRole = runtime.getCurrentUser().role;
                        let allowedRoles = [1019, 1041];

                        if (allowedRoles.includes(userRole)){
                            form.addButton({
                                    id: 'custpage_get_quote_details',
                                    label: 'Quote Details',
                                    functionName: `getQuoteDetails("${quoteNumber}", "${internalid}", "${proceed}")`
                            });

                            if (opportunityNumber) {
                                form.addButton({
                                        id: 'custpage_get_renewal_details',
                                        label: 'Get Renewal',
                                        functionName: `getRenewalDetails("${opportunityNumber}", "${internalid}")`
                                });
                            }
                        }

                        form.addButton({
                            id: 'custpage_get_quote_details',
                            label: 'Finalize',
                            functionName: `finalizeQuote("${quoteNumber}", "${internalid}", "${finalizeDate}")`
                        });
                          

                        form.clientScriptModulePath = '../CustomModules/ng_cm_quote.js'

                }

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContextadministrator            
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            if (scriptContext.type === scriptContext.UserEventType.DELETE) return;

            const quoteRecord = scriptContext.newRecord;
            const autodeskQuoteNumber = quoteRecord.getValue({
                fieldId: 'custbody_hco_adesk_quote_num'
            });

            if (autodeskQuoteNumber) {
                quoteRecord.setValue({
                    fieldId: 'custbody_ava_disable_tax_calculation',
                    value: true
                });

                log.debug('Avalara tax calculation disabled for Autodesk quote', {
                    quoteId: quoteRecord.id,
                    autodeskQuoteNumber: autodeskQuoteNumber
                });
            }

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try {
                if (scriptContext.type === scriptContext.UserEventType.DELETE) return;
        
                const quoteRecord = scriptContext.newRecord;
                const quoteId = quoteRecord.id;
        
                // Reload the record to work with line items if needed
                const fullQuote = record.load({
                    type: record.Type.ESTIMATE,
                    id: quoteId,
                    isDynamic: false
                });
        
                const lineCount = fullQuote.getLineCount({ sublistId: 'item' });
                let totalAmount = 0;
        
                for (let i = 0; i < lineCount; i++) {
                    const isExcluded = fullQuote.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_hco_exclude_line_forecast', //custcol_hco_exclude_line_forecast:
                        line: i
                    });
        
                    if (!isExcluded) {
                        const amount = fullQuote.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            line: i
                        }) || 0;
        
                        totalAmount += parseFloat(amount);
                    }
                }
        
                const opportunityId = fullQuote.getValue({
                    fieldId: 'opportunity'
                });

                const quoteStatus = fullQuote.getValue({
                    fieldId: 'custbody_hco_quote_status'
                });
        
                if (opportunityId && quoteStatus == 6) {
                    const oppRecord = record.load({
                        type: record.Type.OPPORTUNITY,
                        id: opportunityId
                    });
        
                    oppRecord.setValue({
                        fieldId: 'custbody_hco_hubspot_opp_total',
                        value: totalAmount
                    });

                    oppRecord.setValue({
                        fieldId: 'custbody_custentity_ss_sync_to_hubspot',
                        value: true
                    });
        
                    oppRecord.save();
                    log.debug('Opportunity updated', `Set custbody_hco_hubspot_opp_total to ${totalAmount}`);
                } else if (opportunityId) {
                    log.debug('Opportunity update skipped', `Quote status ${quoteStatus} is not Completed.`);
                } else {
                    log.debug('No opportunity linked to this quote.');
                }
        
            } catch (error) {
                log.error('Error in afterSubmit', error);
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });

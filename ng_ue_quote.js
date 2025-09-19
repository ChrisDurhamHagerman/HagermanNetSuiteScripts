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

                        let finalizeDate = quoteRec.getValue({
                            fieldId: 'custbody_hco_adesk_quote_finalized'
                        });

                        let internalid = quoteRec.id;

                        let proceed = false;

                        log.debug({title: 'Quote Number', details: quoteNumber});
                        log.debug({title: 'Transaction ID', details: internalid});

                        let form = scriptContext.form;
                        let userRole = runtime.getCurrentUser().role;
                        let allowedRoles = [1019, 1041];

                        if (allowedRoles.includes(userRole)){
                            form.addButton({
                                    id: 'custpage_get_quote_details',
                                    label: 'Quote Details',
                                    functionName: `getQuoteDetails("${quoteNumber}", "${internalid}", "${proceed}")`
                            });
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
        
                if (opportunityId) {
                    const oppRecord = record.load({
                        type: record.Type.OPPORTUNITY,
                        id: opportunityId
                    });
        
                    oppRecord.setValue({
                        fieldId: 'custbody_hco_hubspot_opp_total',
                        value: totalAmount
                    });
        
                    oppRecord.save();
                    log.debug('Opportunity updated', `Set custbody_hco_hubspot_opp_total to ${totalAmount}`);
                } else {
                    log.debug('No opportunity linked to this quote.');
                }
        
            } catch (error) {
                log.error('Error in afterSubmit', error);
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
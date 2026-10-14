/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

define(['N/search', 'N/log', 'N/https'], function (search, log, https) {
    var SEARCH_ID = 'customsearch5485';
    var ENDPOINT_URL = 'https://ns-autodesk.hagerman.com:44306/api/TwoQuarterImport/import';

    function execute(context) {
        try {
            var savedSearch = search.load({ id: SEARCH_ID });
            var pagedResults = savedSearch.runPaged({ pageSize: 1000 });
            var jsonData = [];

            pagedResults.pageRanges.forEach(function (pageRange) {
                var page = pagedResults.fetch({ index: pageRange.index });

                page.data.forEach(function (result) {
                    var row = {};
                    result.columns.forEach(function (column) {
                        var key = column.label || column.name;
                        row[key] = result.getValue(column) || '';
                    });
                    jsonData.push(row);
                });
            });

            if (jsonData.length === 0) {
                throw new Error('Saved search ' + SEARCH_ID + ' returned no rows.');
            }

            var response = https.post({
                url: ENDPOINT_URL,
                body: JSON.stringify(jsonData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            var statusCode = parseInt(response.code, 10);
            if (statusCode < 200 || statusCode >= 300) {
                throw new Error(
                    'Two-quarter API returned HTTP ' + response.code + ': ' + response.body);
            }

            log.audit({
                title: 'Two-quarter Autodesk orders exported',
                details: 'Sent ' + jsonData.length + ' rows. Response: ' + response.body
            });
        } catch (error) {
            log.error({
                title: 'Error exporting two-quarter Autodesk orders',
                details: error && error.stack ? error.stack : error.toString()
            });
            throw error;
        }
    }

    return {
        execute: execute
    };
});

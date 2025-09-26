/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

define(['N/search', 'N/log', 'N/https'], function (search, log, https) {

    function execute(context) {
        try {
            // 1) Load the saved search
            var mySearch = search.load({
                id: 'customsearch3499'
            });

            // 2) Run and gather all results (1000 per page)
            var searchResults = [];
            var resultSet = mySearch.run();

            var start = 0;
            var pageSize = 1000;
            var page;
            do {
                page = resultSet.getRange({ start: start, end: start + pageSize }) || [];
                if (page.length > 0) {
                    searchResults = searchResults.concat(page);
                    start += pageSize;
                }
            } while (page.length === pageSize);

            log.audit('Search Complete', 'Total results: ' + searchResults.length);

            if (!searchResults.length) {
                log.audit('No Data', 'Search returned no rows. Skipping POST.');
                return;
            }

            // 3) Convert results to JSON
            var jsonData = searchResults.map(function (result) {
                var obj = {};
                result.columns.forEach(function (col) {
                    var key = col.label || col.name;
                    obj[key] = result.getValue(col) || '';
                });
                return obj;
            });

            // 4) POST to endpoint
            var response = https.post({
                url: 'https://ns-autodesk.hagerman.com:44306/api/WorkflowMessageTransaction/import',
                body: JSON.stringify(jsonData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            log.debug('POST Response Code', response.code);
            log.debug('POST Response Body', response.body);

        } catch (e) {
            log.error('Error Running Search/Export', e && e.message ? e.message : e.toString());
        }
    }

    return {
        execute: execute
    };

});

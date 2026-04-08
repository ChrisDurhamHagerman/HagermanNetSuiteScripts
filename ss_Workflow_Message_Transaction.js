/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/log', 'N/https'], function (search, log, https) {

    function execute(context) {
        try {
            log.audit('Script Start', 'WorkflowMessageTransaction export process beginning.');

            // 1) Load the saved search
            var searchId = 'customsearch5833';
            log.debug('Loading Search', 'Search ID: ' + searchId);
            var mySearch = search.load({ id: searchId });

            // 2) Run and gather all results (1000 per page)
            var searchResults = [];
            var resultSet = mySearch.run();

            var start = 0;
            var pageSize = 1000;
            var page;
            do {
                log.debug('Fetching Page', 'Start: ' + start + ', End: ' + (start + pageSize));
                page = resultSet.getRange({ start: start, end: start + pageSize }) || [];
                if (page.length > 0) {
                    searchResults = searchResults.concat(page);
                    start += pageSize;
                    log.debug('Page Fetched', 'Retrieved ' + page.length + ' results.');
                }
            } while (page.length === pageSize);

            log.audit('Search Complete', 'Total results: ' + searchResults.length);

            if (!searchResults.length) {
                log.audit('No Data', 'Search returned no rows. Skipping POST.');
                return;
            }

            // 3) Convert results to JSON
            var jsonData = [];
            for (var i = 0; i < searchResults.length; i++) {
                var result = searchResults[i];
                var row = {};
                for (var j = 0; j < result.columns.length; j++) {
                    var col = result.columns[j];
                    var key = col.label || col.name;

                    // ✅ Prefer display text (names), fallback to raw value if no text
                    var value = result.getText(col);
                    if (value === null || value === undefined || value === '') {
                        value = result.getValue(col);
                    }

                    row[key] = value || '';
                }
                jsonData.push(row);
            }

            log.debug('JSON Sample', JSON.stringify(jsonData[0] || {}, null, 2));
            log.debug('Total JSON Records', jsonData.length);

            // 4) POST to endpoint
            var endpoint = 'https://ns-autodesk.hagerman.com:44306/api/WorkflowMessageTransaction/import';
            log.audit('Sending POST', 'Posting to endpoint: ' + endpoint);

            var response = https.post({
                url: endpoint,
                body: JSON.stringify(jsonData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            log.audit('POST Complete', 'Response Code: ' + response.code);
            log.debug('POST Response Body', response.body);

        } catch (e) {
            log.error('Fatal Error', e && e.message ? e.message : e.toString());
        }
    }

    return {
        execute: execute
    };
});

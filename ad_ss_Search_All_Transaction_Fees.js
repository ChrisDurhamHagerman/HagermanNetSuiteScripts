/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

define(['N/search', 'N/log', 'N/https'], function (search, log, https) {

    function execute(context) {
        try {
            // Step 1: Load the search
            var mySearch = search.load({
                id: 'customsearch5385' 
            });

            // Step 2: Run the search and get all results
            var searchResults = [];
            var searchResultSet = mySearch.run();
            var resultsRange = searchResultSet.getRange({
                start: 0,
                end: 1000
            });

            while (resultsRange.length > 0) {
                searchResults = searchResults.concat(resultsRange);
                resultsRange = searchResultSet.getRange({
                    start: searchResults.length,
                    end: searchResults.length + 1000
                });
            }

            // Convert search results to JSON
            var jsonData = searchResults.map(function(result) {
                var jsonObject = {};
                result.columns.forEach(function(column) {
                    jsonObject[column.label || column.name] = result.getValue(column) || '';
                });
                return jsonObject;
            });

            // Step 4: Send JSON data to API
            var response = https.post({
                url: 'https://ns-autodesk.hagerman.com:44306/api/CsvImport/import', // Update with your actual endpoint
                body: JSON.stringify(jsonData), // Convert JSON object to string
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            log.debug('Response', response.body);

        } catch (error) {
            log.error('Error Running Search and Exporting JSON', error.toString());
        }
    }

    return {
        execute: execute
    };

});

//https://82f2-2601-242-601-1880-b9ae-f836-dcce-15fb.ngrok-free.app/api/CsvImport/import
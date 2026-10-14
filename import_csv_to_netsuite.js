/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

define(['N/https', 'N/file', 'N/task', 'N/log'], function (https, file, task, log) {

    function execute(context) {
        try {
            //Step 1: Download the CSV file from your API
            var response = https.get({
                url: 'https://ns-autodesk.hagerman.com:44306/api/CsvImport/download/NetsuiteImportData.csv'
            });

            if (response.code !== 200) {
                throw 'Download failed: HTTP ' + response.code;
            }

            var csvContents = response.body || '';
            csvContents = csvContents.replace(/^\uFEFF/, '');

            var headerLine = csvContents.split(/\r?\n/)[0] || '';
            log.debug('CSV Header', headerLine);

            if (!/(^|,)("?)(InternalID|id|externalid|tranid)\2(,|$)/i.test(headerLine)) {
                throw 'CSV missing Sales Order identifier column. Header: ' + headerLine;
            }

            //Step 2: Save the CSV file in the NetSuite file cabinet
            var csvFile = file.create({
                name: 'NetsuiteImportData.csv',
                fileType: file.Type.CSV,
                contents: csvContents,
                folder: 14337963 // Replace with your actual folder ID
            });

            var fileId = csvFile.save();
            log.debug('CSV File Saved', 'File ID: ' + fileId);

            //Step 3: Submit the file to the saved CSV import
            var importTask = task.create({
                taskType: task.TaskType.CSV_IMPORT
            });

            importTask.mappingId = 'custimport_398_290783_295_v2'; // Your saved import ID
            importTask.importFile = file.load({ id: fileId });

            var taskId = importTask.submit();
            log.audit('CSV Import Submitted', 'Task ID: ' + taskId);

        } catch (e) {
            log.error('Import error', e.toString());
        }
    }

    return {
        execute: execute
    };

});



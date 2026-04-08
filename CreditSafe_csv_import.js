/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/task','N/log'], function(task, log) {

    function post(context) {
        try {
            var csv = context.csv;
            if (!csv) {
                return { success: false, message: "No CSV received." };
            }

            var map = task.create({
                taskType: task.TaskType.CSV_IMPORT
            });

            map.mappingId = "custimport_257_290783_596";  // Your import
            map.importFile = csv;

            var taskId = map.submit();

            return { success: true, taskId: taskId };

        } catch (e) {
            log.error("Import failed", e);
            return { success: false, message: e.toString() };
        }
    }

    return { post: post };
});

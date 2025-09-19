/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/runtime','N/log'], (runtime, log) => {
    const SYNC_SMART_USER = 389409;
    const PARENT_FIELD    = 'company';
  
    function beforeSubmit(context) {
      // only on record edits by the Sync Smart integration user
      if (
        context.type === context.UserEventType.EDIT &&
        Number(runtime.getCurrentUser().id) === SYNC_SMART_USER
      ) {
        const newRec    = context.newRecord;
        const oldRec    = context.oldRecord;
        const oldParent = oldRec.getValue({ fieldId: PARENT_FIELD });
        const newParent = newRec.getValue({ fieldId: PARENT_FIELD });
  
        // if Sync Smart tried to change the parent, revert it
        if (newParent !== oldParent) {
          newRec.setValue({ fieldId: PARENT_FIELD, value: oldParent });
          log.audit(
            'Blocked Parent Change',
            `Contact ${newRec.id}: parent kept at ${oldParent} (Sync Smart attempted ${newParent})`
          );
        }
      }
    }
  
    return { beforeSubmit };
  });
  
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/search', 'N/log'], (search, log) => {

    function runSavedSearchToRows(searchId) {
      const s = search.load({ id: searchId });
      const cols = s.columns.map(c => c.label || c.name);
      const rows = [];
  
      const paged = s.runPaged({ pageSize: 1000 });
      paged.pageRanges.forEach(range => {
        const page = paged.fetch({ index: range.index });
        page.data.forEach(result => {
          const row = {};
          for (let i = 0; i < s.columns.length; i++) {
            row[cols[i]] = result.getValue(s.columns[i]) || '';
          }
          rows.push(row);
        });
      });
  
      return { columns: cols, rows };
    }
  
    function toCsv(columns, rows) {
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = columns.join(',');
      const body = rows.map(r => columns.map(c => esc(r[c])).join(','));
      return [header, ...body].join('\n');
    }
  
    function get(context) {
      try {
        log.audit('CreditSafe RESTlet', 'Starting saved searches');
  
        const customer = runSavedSearchToRows('customsearch2792'); // JMH-TC-Customer Sync
        const invoice  = runSavedSearchToRows('customsearch2779'); // JMH-TC Invoice DSO Sync
  
        const customerCsv = toCsv(customer.columns, customer.rows);
        const invoiceCsv  = toCsv(invoice.columns,  invoice.rows);
  
        log.audit('CreditSafe RESTlet', `Rows: customer=${customer.rows.length}, invoice=${invoice.rows.length}`);
  
        return {
          customerCsv,
          invoiceCsv
        };
      } catch (e) {
        log.error('RESTlet Error', e);
        throw e;
      }
    }
  
    // If you later want POST instead of GET, export { post } similarly.
    return { get };
  });
  
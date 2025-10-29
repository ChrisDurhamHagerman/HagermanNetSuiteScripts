/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/search','N/log'], (search, log) => {
  const MAX_PAGE_SIZE = 500;

  const S   = v => (v == null ? '' : String(v));
  const esc = v => '"' + S(v).replace(/"/g, '""') + '"';

  function buildCsv(columns, rows, includeHeader) {
    const header = includeHeader ? columns.map(esc).join(',') : null;
    const body   = rows.map(r => columns.map(c => esc(r[c])).join(',')).join('\n');
    return includeHeader ? (header + (body ? '\n' + body : '')) : body;
  }

  function get(context) {
    // Paging params
    const pageReq     = parseInt((context && context.page)     || '0', 10);
    const pageSizeReq = parseInt((context && context.pageSize) || '0', 10);
    const forceHeader = String((context && context.header) || '').toLowerCase() === 'true';

    const pageIndex = (isFinite(pageReq)     && pageReq     >= 0) ? pageReq     : 0;
    const pageSize  = (isFinite(pageSizeReq) && pageSizeReq >  0) ? Math.min(pageSizeReq, MAX_PAGE_SIZE) : MAX_PAGE_SIZE;

    // ---------------- SAFE Invoice search (no custom fields anywhere) ----------------
    // Filters: type CustInvc, mainline true, trandate >= daysago548, amount > 0
    const filters = [
      ['type','anyof','CustInvc'], 'AND',
      ['mainline','is','T'],       'AND',
      ['trandate','onorafter','daysago548'], 'AND',
      ['amount','greaterthan','0.00']
    ];

    // Select only native columns (no formulas, no custom joins)
    const columns = [
      search.createColumn({ name: 'internalid' }),
      search.createColumn({ name: 'entity' }),
      search.createColumn({ name: 'tranid' }),
      search.createColumn({ name: 'amount' }),
      search.createColumn({ name: 'trandate' }),
      search.createColumn({ name: 'daysopen' }),
      search.createColumn({ name: 'daysoverdue' }),
      search.createColumn({ name: 'duedate' }),
      search.createColumn({ name: 'createdfrom' }),
      search.createColumn({ name: 'statusref' })
    ];
    const headers = columns.map(c => c.label || c.name || 'internalid');

    log.audit('CreditSafe RESTlet (SAFE invoice search)',
      `page=${pageIndex}, pageSize=${pageSize}, header=${forceHeader}`);

    // Include your settings (consolidationtype=ACCTTYPE)
    const s = search.create({
      type: search.Type.INVOICE,
      filters: filters,
      columns: columns,
      settings: [
        { name: 'consolidationtype', value: 'ACCTTYPE' }
      ]
    });

    const paged = s.runPaged({ pageSize });
    if (paged.count === 0 || paged.pageRanges.length === 0) {
      return forceHeader ? buildCsv(headers, [], true) : '';
    }
    if (pageIndex < 0 || pageIndex >= paged.pageRanges.length) {
      return '';
    }

    const page = paged.fetch({ index: pageIndex });

    const rows = [];
    page.data.forEach(result => {
      const row = {};
      for (let i = 0; i < columns.length; i++) {
        const key = headers[i] || `col_${i}`;
        let val = '';
        try { val = result.getValue(columns[i]); } catch (_e) { val = ''; }
        row[key] = S(val);
      }
      rows.push(row);
    });

    const includeHeader = forceHeader || pageIndex === 0;
    const csv = buildCsv(headers, rows, includeHeader);
    return csv; // return TEXT
  }

  return { get };
});

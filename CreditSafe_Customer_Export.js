/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/search','N/log'], (search, log) => {
  const MAX_PAGE_SIZE = 1000;

  const S   = v => (v == null ? '' : String(v));
  const esc = v => '"' + S(v).replace(/"/g, '""') + '"';

  function buildCsv(columns, rows, includeHeader) {
    const header = includeHeader ? columns.map(esc).join(',') : null;
    const body   = rows.map(r => columns.map(c => esc(r[c])).join(',')).join('\n');
    return includeHeader ? (header + (body ? '\n' + body : '')) : body;
  }

  function get(context) {
    // paging params
    const pageReq     = parseInt((context && context.page)     || '0', 10);
    const pageSizeReq = parseInt((context && context.pageSize) || '0', 10);
    const forceHeader = String((context && context.header) || '').toLowerCase() === 'true';

    const pageIndex = (isFinite(pageReq)     && pageReq     >= 0) ? pageReq     : 0;
    const pageSize  = (isFinite(pageSizeReq) && pageSizeReq >  0) ? Math.min(pageSizeReq, MAX_PAGE_SIZE) : MAX_PAGE_SIZE;

    // --------------------------------------------------------------------
    // IMPORTANT: build a NEW, SAFE Customer search with only native filters
    // (no custom fields in filters, so no SSS_INVALID_SRCH_FILTER)
    // --------------------------------------------------------------------
    // Original had:
    //   OR-group on custentity_* fields  <-- we DROP this entirely
    //   AND status anyof [...]
    //   AND companyname doesnotstartwith "test"
    const safeFilters = [
      ['status','anyof','13','15','20','14','18','8','11','19','10'],
      'AND',
      ['companyname','doesnotstartwith','test']
    ];

    // Safe native columns only (no custom columns)
    const columns = [
        search.createColumn({name: "internalid", label: "InternalID"}),
        search.createColumn({name: "entityid", label: "Customer"}),
        search.createColumn({name: "creditlimit", label: "Credit Limit"}),
        search.createColumn({name: "custentity_hco_creditsafe_id", label: "Credit Safe ID"}),
        //search.createColumn({name: "custentity_hco_creditsafe_credit_limit", label: "Credit Safe Credit Limit"}),
        search.createColumn({name: "custentity_hco_creditsafe_refresh_flag", label: "Credit Safe Refresh Required"}),
        search.createColumn({name: "custentity_hco_tc_base_dep_level", label: "Base Deposit Level"}),
        search.createColumn({name: "custentity_hco_tc_effective_dep_level", label: "Effective Deposit Level"}),
        search.createColumn({name: "custentity_hco_tc_weighted_dbt", label: "Weighted DBT"}),
        search.createColumn({name: "custentity_hco_tc_effective_dso", label: "Effective DSO"}),
        search.createColumn({name: "custentity_hco_tc_hco_credit_limit", label: "HCO Credit Limit"}),
        search.createColumn({name: "custentity_hco_tc_last_eff_dep_lvl_chg", label: "Last Effective Deposit Level Change"}),
        search.createColumn({name: "custentity_hco_tc_override_hco_cred_lvl", label: "Override HCO Credit Level"})
     ];
    const headers = columns.map(c => c.label || c.name || 'internalid');

    log.audit('CreditSafe RESTlet (SAFE customer search)',
      `page=${pageIndex}, pageSize=${pageSize}, header=${forceHeader}`);

    const s = search.create({
      type: search.Type.CUSTOMER,
      filters: safeFilters,
      columns: columns
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

# Autodesk Renewal Workflow Production Setup Guide

## Purpose

This guide documents the NetSuite fields, Autodesk parameters, and script behavior required to move the Autodesk renewal workflow into production.

The renewal workflow does **not** write quote lines directly from the Autodesk opportunity response.
Instead, it works like this:

1. User enters an Autodesk Opportunity ID on the NetSuite quote.
2. User clicks `Get Renewal`.
3. NetSuite calls Autodesk `Get Opportunity v2`.
4. NetSuite uses that response to call Autodesk `Create Quote v3`.
5. Autodesk returns a `transactionId`.
6. NetSuite stores that `transactionId` on the quote.
7. Autodesk later sends a `quote-status` webhook.
8. The webhook finds the quote by `transactionId` or `quoteNumber`.
9. When Autodesk returns a real `quoteNumber`, NetSuite saves it and triggers the existing `Get Quote Details` flow.
10. The existing quote line import logic populates the NetSuite quote lines.

## Scripts Involved

- `ng_ue_quote.js`
  - Adds the `Get Renewal` button to the quote form.
- `ng_cm_quote.js`
  - Calls the Suitelet when the user clicks `Get Renewal`.
  - Refreshes the page after the Autodesk create request is accepted so the user can see the saved transaction id.
- `ng_sl_autodesk_tasks.js`
  - Handles:
    - Autodesk `Get Opportunity v2`
    - Autodesk `Create Quote v3`
    - storing Autodesk transaction id on the quote
    - existing `Get Quote Details` import flow
- `ng_sl_status_update_webhook.js`
  - Handles Autodesk `quote-status` webhooks.
  - Finds the quote by `quoteNumber` or `transactionId`.
  - Saves Autodesk quote number and status.
  - Triggers the existing quote import when the quote is ready.

## Required NetSuite Fields

### Quote / Estimate Fields

These fields are required on the NetSuite quote record:

- `custbody_hco_adesk_quote_num`
  - Existing Autodesk quote number field.
- `custbody_hco_adesk_transaction_id`
  - New field used to store Autodesk `transactionId` from `Create Quote v3`.
- `custbody_hco_prepared_by`
  - Employee field.
  - The employee email is used as `agentContact.email` in the Autodesk create quote request.
- `custbody_hco_adesk_quote_status`
  - Used by the webhook to store Autodesk quote status.
- `custbody_hco_adesk_quote_expires`
  - Used when the quote is returned as `Quoted`.
- `custbody_hco_adesk_quote_finalized`
  - Existing field used by the finalize flow.

## New Parameters Added For Renewal Workflow

These are the main new parameters and values introduced for the renewal process.

### NetSuite Record Parameters

- `custbody_hco_adesk_transaction_id`
  - Stores the Autodesk `transactionId` returned by `Create Quote v3`.
- `custbody_hco_prepared_by`
  - Employee lookup used to derive `agentContact.email`.
- `custbody_hco_opportunity_id`
  - Recommended production field id for the Autodesk Opportunity ID entered by the user.
- `custbody_hco_adesk_quote_recipients`
  - Optional semicolon-separated email list if you decide to support extra quote recipients.

### Autodesk Create Quote Payload Parameters

- `opportunityNumber`
  - Taken from the quote-level Autodesk Opportunity ID field.
- `currency`
  - Taken from the Autodesk opportunity response.
- `endCustomer`
  - Built from the Autodesk opportunity response.
- `quoteContact`
  - Built from the Autodesk opportunity response.
- `agentAccount.accountCsn`
  - Partner CSN used in the Autodesk request.
- `agentContact.email`
  - Now sourced from the NetSuite `Prepared By` employee email when available.

### Script Configuration Parameters

- `consumerKey`
  - Autodesk API consumer key for the target environment.
- `consumerSecret`
  - Autodesk API consumer secret for the target environment.
- `environmentUrl`
  - Autodesk host name for staging or production.
- `mySecret`
  - NetSuite secret id used for Autodesk request signing.

### Quote Opportunity ID Field

The quote also needs an Autodesk Opportunity ID field.

Current code reference:

- `custbodycustbody_hco_opportunity_id`

Important note:

- This field id was created with a duplicated prefix during sandbox testing.
- In production, it is recommended to create the clean field id:
  - `custbody_hco_opportunity_id`
- If production uses the clean field id, `ng_ue_quote.js` must be updated before deployment.

## Optional Opportunity Field

If you want to support additional quote-recipient emails on the NetSuite Opportunity record, create:

- `custbody_hco_adesk_quote_recipients`

Recommended format:

- `Long Text`
- semicolon-separated email list only
- example:
  - `user1@company.com;user2@company.com`

Note:

- As of this guide, this field is a design decision we discussed, but it should only be documented as production-required if you also deploy the matching payload code.

## Production Autodesk Configuration

### `ng_sl_autodesk_tasks.js`

Before production deployment, confirm these top-level constants are set to production values:

- `consumerKey`
- `consumerSecret`
- `environmentUrl`
- `mySecret`

For production, this should normally mean:

- `environmentUrl = "enterprise-api.autodesk.com"`
- `mySecret = "<your production NetSuite secret id>"`

Example values currently used in sandbox/testing should **not** be promoted unchanged.

### `ng_sl_status_update_webhook.js`

This script must use the same production Autodesk environment and credentials as the renewal flow so webhook lookups and quote detail calls stay aligned.

## NetSuite Secret

Create or confirm the production API secret used by the tasks script.

The script expects:

- `mySecret`
  - NetSuite API secret id used for Autodesk HMAC signature generation

Production checklist:

- secret exists in production
- secret id matches the script constant
- value is correct
- access is granted to the deployed Suitelet script/deployment

## Prepared By Behavior

`ng_sl_autodesk_tasks.js` now loads the quote record and reads:

- `custbody_hco_prepared_by`

It then looks up the employee record email and uses that value as:

- `agentContact.email`

Fallback behavior:

- if `Prepared By` is blank
- or the employee has no email

the script falls back to the hardcoded testing email currently present in the script.

Production recommendation:

- either ensure every user in `Prepared By` has a valid employee email
- or replace the fallback with a production-approved Autodesk agent email

## Webhook Behavior

The webhook now supports asynchronous quote creation.

Autodesk may send a `quote-status` payload like:

- `transactionId = <guid>`
- `quoteNumber = "NA"`

or later:

- `transactionId = <guid>`
- `quoteNumber = Q-1234567`

The webhook logic now:

1. tries to find the quote by `custbody_hco_adesk_quote_num`
2. if not found, falls back to `custbody_hco_adesk_transaction_id`
3. saves:
   - Autodesk status
   - Autodesk transaction id
   - Autodesk quote number when available
4. triggers the existing quote import when the quote reaches the importable status and has a real quote number

## Existing Quote Import Reused

The renewal workflow intentionally reuses the existing quote line importer.

That means the following logic should remain intact:

- `Get Quote Details`
- `getLineItems(...)`
- `updateQuoteWithLineItems(...)`

This is important because Autodesk `Get Opportunity v2` does not exactly match the data shape used by the line importer, while `Get Quote Details` does.

## Production Deployment Checklist

### NetSuite

- Create or confirm `custbody_hco_adesk_transaction_id`
- Confirm `custbody_hco_prepared_by` exists and is populated with valid employees
- Confirm the Autodesk Opportunity ID field exists on the quote
- If using clean field id in production, update `ng_ue_quote.js`
- Confirm all required Autodesk fields are on the correct quote form
- Confirm users can see and edit the needed fields

### Autodesk / Credentials

- Set production `consumerKey`
- Set production `consumerSecret`
- Set production `environmentUrl`
- Set production NetSuite API secret id
- Confirm approved agent email behavior for `Prepared By`

### Webhook

- Confirm production webhook points to `ng_sl_status_update_webhook.js`
- Confirm production Autodesk environment sends `quote-status` events
- Confirm webhook traffic reaches the production account

### Testing

- Create a quote with a valid Autodesk Opportunity ID
- Click `Get Renewal`
- Confirm `custbody_hco_adesk_transaction_id` is saved
- Confirm webhook later updates `custbody_hco_adesk_quote_num`
- Confirm quote status is updated
- Confirm existing quote detail import populates quote lines

## Production Risk Notes

- The current codebase still contains some sandbox/testing values and should be reviewed before production deployment.
- The duplicated sandbox field id `custbodycustbody_hco_opportunity_id` should not be copied into production unless that is intentional.
- If the optional quote-recipient email field is added to production, make sure the payload code is updated and tested before relying on it.

## Suggested Presentation Summary

You can describe the production workflow like this:

We added a renewal-specific Autodesk flow that starts from Opportunity ID, creates the Autodesk quote asynchronously, stores Autodesk's transaction id on the NetSuite quote, and then uses the Autodesk quote-status webhook to connect the finished quote back to NetSuite. Once Autodesk returns a real quote number, we reuse the existing quote-details import logic so renewals populate quote lines through the same stable path as normal Autodesk quotes.

# Staged Claims Storage and Remittance Reconciliation

This document describes the staged claims workflow feature that allows insurance providers to upload claims and remittances separately, with reconciliation performed when remittances are available.

## Overview

The system now supports three workflows for claim reconciliation:

1. **Claims-only upload**: Upload and store claims with `awaiting_remittance` status
2. **Remittance upload**: Upload remittances and automatically reconcile against stored claims
3. **Combined upload**: Upload both files together (maintains backward compatibility)

## API Endpoints

### 1. Upload Claims Only

**Endpoint**: `POST /api/claim-reconciliation/upload-claims`

**Purpose**: Store claims for a provider and period without performing reconciliation. Useful when you have submitted claims but haven't received remittance yet.

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Authentication: Required

**Form Fields**:
- `providerName` (string, required): Insurance provider name (e.g., "CIC")
- `periodYear` (number, required): Year of the claim period (e.g., 2025)
- `periodMonth` (number, required): Month of the claim period (1-12)
- `claimsFile` (file, required): Excel file containing claims data

**Response** (200 OK):
```json
{
  "success": true,
  "provider": "CIC",
  "period": "2025-08",
  "claimsStored": 150,
  "message": "150 claims stored and awaiting remittance"
}
```

**Behavior**:
- Parses the claims file using existing parser
- Replaces any existing claims for the same provider+period (standalone claims only)
- Sets all claims to `awaiting_remittance` status
- Does NOT perform reconciliation
- Re-uploading claims replaces previous claims and resets status

### 2. Upload Remittance Only

**Endpoint**: `POST /api/claim-reconciliation/upload-remittance`

**Purpose**: Upload remittance file and automatically reconcile against stored claims for the same provider+period.

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Authentication: Required

**Form Fields**:
- `providerName` (string, required): Insurance provider name (e.g., "CIC")
- `periodYear` (number, required): Year of the remittance period (e.g., 2025)
- `periodMonth` (number, required): Month of the remittance period (1-12)
- `remittanceFile` (file, required): Excel file containing remittance data

**Response** (200 OK):
```json
{
  "success": true,
  "provider": "CIC",
  "period": "2025-08",
  "remittancesStored": 120,
  "reconciliation": {
    "totalClaims": 150,
    "totalRemittances": 120,
    "autoMatched": 115,
    "partialMatched": 3,
    "manualReview": 2,
    "unpaidClaims": 30,
    "orphanRemittances": 5
  },
  "message": "Remittances uploaded and reconciliation completed"
}
```

**Response** (400 Bad Request - No Claims):
```json
{
  "error": "No claims found for CIC for 2025-08. Please upload claims first.",
  "suggestion": "Please upload claims for this provider and period first"
}
```

**Behavior**:
- Validates that claims exist for the provider+period
- Returns 400 error with clear message if no claims found
- Parses the remittance file
- Replaces any existing remittances for the same provider+period
- Automatically runs reconciliation
- Updates claim statuses based on matching:
  - `matched`: Exact or full payment match
  - `partially_paid`: Partial payment received
  - `unpaid`: No matching remittance found
  - `manual_review`: Requires manual attention
- Marks unmatched remittances as `orphan_remittance`

### 3. Get Period Status

**Endpoint**: `GET /api/claim-reconciliation/period/:providerName/:year/:month`

**Purpose**: Check the status of claims and remittances for a specific provider and period.

**Request**:
- Method: `GET`
- Authentication: Required
- Path Parameters:
  - `providerName`: Insurance provider name
  - `year`: Period year (e.g., 2025)
  - `month`: Period month (1-12)

**Response** (200 OK):
```json
{
  "provider": "CIC",
  "period": "2025-08",
  "claims": {
    "total": 150,
    "awaitingRemittance": 0,
    "matched": 115,
    "partiallyPaid": 3,
    "unpaid": 30
  },
  "remittances": {
    "total": 120,
    "orphans": 5
  },
  "hasClaimsOnly": false,
  "hasRemittances": true,
  "isReconciled": true
}
```

**Use Cases**:
- Check if claims have been uploaded for a period
- Check if remittances have been uploaded
- View reconciliation status without downloading full details

### 4. Combined Upload (Legacy)

**Endpoint**: `POST /api/claim-reconciliation/upload`

**Purpose**: Upload both claims and remittances together and perform immediate reconciliation (backward compatible).

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Authentication: Required

**Form Fields**:
- `providerName` (string, required)
- `periodYear` (number, required)
- `periodMonth` (number, required)
- `claimsFile` (file, required)
- `remittanceFile` (file, required)

**Behavior**:
- Internally creates a reconciliation "run" for audit trail
- Stores both claims and remittances with the run
- Performs matching
- Returns summary statistics

## Claim Status Values

The system uses the following status values for claims:

| Status | Description |
|--------|-------------|
| `awaiting_remittance` | Claim uploaded, waiting for remittance data |
| `matched` | Claim fully matched with remittance payment |
| `partially_paid` | Claim partially paid (amount paid < claimed amount) |
| `unpaid` | No matching remittance found for this claim |
| `manual_review` | Requires manual review (e.g., unusual payment patterns) |

## Remittance Status Values

| Status | Description |
|--------|-------------|
| `null` | Normal remittance matched to a claim |
| `orphan_remittance` | Remittance received but no matching claim found |

## Workflow Examples

### Example 1: Claims-First Workflow

1. Upload claims for CIC August 2025:
```bash
curl -X POST http://localhost:5000/api/claim-reconciliation/upload-claims \
  -F "providerName=CIC" \
  -F "periodYear=2025" \
  -F "periodMonth=8" \
  -F "claimsFile=@CIC_Claims_Aug2025.xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "provider": "CIC",
  "period": "2025-08",
  "claimsStored": 150,
  "message": "150 claims stored and awaiting remittance"
}
```

2. Later, when remittance received, upload remittance:
```bash
curl -X POST http://localhost:5000/api/claim-reconciliation/upload-remittance \
  -F "providerName=CIC" \
  -F "periodYear=2025" \
  -F "periodMonth=8" \
  -F "remittanceFile=@CIC_Remittance_Aug2025.xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response includes reconciliation summary showing matched, unpaid, and orphan records.

### Example 2: Re-uploading Claims

If you need to update claims (e.g., found errors in original file):

```bash
curl -X POST http://localhost:5000/api/claim-reconciliation/upload-claims \
  -F "providerName=CIC" \
  -F "periodYear=2025" \
  -F "periodMonth=8" \
  -F "claimsFile=@CIC_Claims_Aug2025_Corrected.xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- Replaces previous claims
- Resets all claims to `awaiting_remittance` status
- Previous reconciliation results are discarded
- Need to re-upload remittance to reconcile again

### Example 3: Re-uploading Remittance

If remittance data changes:

```bash
curl -X POST http://localhost:5000/api/claim-reconciliation/upload-remittance \
  -F "providerName=CIC" \
  -F "periodYear=2025" \
  -F "periodMonth=8" \
  -F "remittanceFile=@CIC_Remittance_Aug2025_Updated.xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- Replaces previous remittances
- Automatically re-runs reconciliation
- Updates claim statuses based on new remittance data

## Database Schema

### Extended Columns

**claim_recon_claims**:
- `provider_name`: VARCHAR(128) NOT NULL - Insurance provider
- `period_year`: INTEGER NOT NULL - Claim period year
- `period_month`: INTEGER NOT NULL - Claim period month (1-12)
- `run_id`: INTEGER NULL - Optional link to reconciliation run
- `status`: VARCHAR(32) DEFAULT 'awaiting_remittance' - Claim status
- `created_at`: TIMESTAMP - When claim was uploaded

**claim_recon_remittances**:
- `provider_name`: VARCHAR(128) NOT NULL - Insurance provider
- `period_year`: INTEGER NOT NULL - Remittance period year
- `period_month`: INTEGER NOT NULL - Remittance period month (1-12)
- `run_id`: INTEGER NULL - Optional link to reconciliation run
- `status`: VARCHAR(32) - Remittance status (NULL or 'orphan_remittance')
- `created_at`: TIMESTAMP - When remittance was uploaded

### Indices

For optimal query performance, the following indices are created:
- `idx_claims_provider_period` on (provider_name, period_year, period_month)
- `idx_remittances_provider_period` on (provider_name, period_year, period_month)
- `idx_claims_status` on (status)
- `idx_remittances_status` on (status)

## Migration

Run the migration script to add support for staged workflow:

```bash
psql -d your_database < migrations/0004_add_staged_claims_workflow.sql
```

Or if using Drizzle Kit:

```bash
npm run db:push
```

## Error Handling

### Common Errors

1. **Missing Claims (400)**:
```json
{
  "error": "No claims found for CIC for 2025-08. Please upload claims first.",
  "suggestion": "Please upload claims for this provider and period first"
}
```
Solution: Upload claims first using `/upload-claims` endpoint.

2. **Invalid File Format (400)**:
```json
{
  "error": "Invalid file type. Only Excel files (.xlsx, .xls) are allowed."
}
```
Solution: Ensure file is in .xlsx or .xls format.

3. **No Valid Data (400)**:
```json
{
  "error": "No valid claims found in the uploaded file"
}
```
Solution: Check that the Excel file has the expected structure and contains data rows.

4. **Missing Parameters (400)**:
```json
{
  "error": "Missing required fields: providerName, periodYear, periodMonth"
}
```
Solution: Include all required form fields in the request.

## Best Practices

1. **Upload claims as soon as submitted**: Don't wait for remittance - upload claims immediately after submission to track pending claims.

2. **Check period status**: Use the `/period/:provider/:year/:month` endpoint to check if claims exist before uploading remittance.

3. **Review orphan remittances**: Payments without matching claims might indicate:
   - Claims not yet uploaded
   - Data entry errors in member numbers or dates
   - Payments for claims from a different period

4. **Review unpaid claims**: Claims without remittances might indicate:
   - Rejected claims
   - Pending approval
   - Data entry errors

5. **Re-reconciliation**: If you need to correct data, you can:
   - Re-upload claims (resets to awaiting_remittance)
   - Re-upload remittances (automatically re-runs reconciliation)
   - Or delete and start fresh

## Integration Notes

### For Frontend Developers

Example React/TypeScript code for uploading claims:

```typescript
async function uploadClaims(
  provider: string,
  year: number,
  month: number,
  file: File
) {
  const formData = new FormData();
  formData.append('providerName', provider);
  formData.append('periodYear', year.toString());
  formData.append('periodMonth', month.toString());
  formData.append('claimsFile', file);

  const response = await fetch('/api/claim-reconciliation/upload-claims', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}
```

### For Testing

Use the test files in `attached_assets/` directory:
- `CIC_Claims_Submitted_Sample.xlsx` - Sample claims file
- `CIC_Remittance_Advice_Sample.xlsx` - Sample remittance file

## Future Enhancements

Potential improvements for future versions:

1. **Partial reconciliation**: Allow marking specific claims/remittances as resolved
2. **Manual matching UI**: Interface to manually match orphan remittances to claims
3. **Notifications**: Alert when remittance is received for pending claims
4. **Batch operations**: Upload multiple periods at once
5. **Export reconciled data**: Download matched/unmatched claims as Excel
6. **Audit trail**: Track who uploaded and modified claims/remittances

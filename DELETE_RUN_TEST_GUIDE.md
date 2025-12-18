# Test Verification Guide: Delete Reconciliation Run Fix

## Overview
This document describes how to test the fix for the deletion failure when deleting a reconciliation run due to FK constraint violations.

## Problem Fixed
Previously, deleting a reconciliation run would fail with error:
```
update or delete on table 'claim_recon_remittances' violates foreign key constraint 
'claim_recon_run_claims_matched_remittance_id_fkey' on table 'claim_recon_run_claims'
```

This occurred because `claim_recon_run_claims.matched_remittance_id` referenced `claim_recon_remittances.id` without an ON DELETE policy.

## Changes Made

### 1. Database Migration (0008_fix_claim_recon_run_claims_fk.sql)
- Drops existing FK constraint `claim_recon_run_claims_matched_remittance_id_fkey`
- Recreates it with `ON DELETE SET NULL` policy
- Migration is idempotent (uses `IF EXISTS`)

### 2. Code Changes (service.ts)
Updated `deleteReconRun()` function to:
1. Explicitly nullify `matched_remittance_id` in `claim_recon_run_claims` before deleting remittances
2. Delete remittances (now safe from FK violations)
3. Delete claims
4. Delete the run itself (join table cascades automatically)

All operations are wrapped in a transaction for atomicity.

### 3. Schema Update (schema.ts)
Updated `claimReconRunClaims` table definition to include `{ onDelete: "set null" }` on `matchedRemittanceId` field.

## Testing Steps

### Prerequisites
1. Running database with the reconciliation tables
2. Admin/staff access to the application
3. Access to DELETE `/api/claim-reconciliation/runs/:runId` endpoint

### Test Procedure

#### Step 1: Setup - Create a Reconciliation Run
1. Log into the application
2. Navigate to Claim Reconciliation
3. Upload claims file for a provider (e.g., CIC)
4. Upload remittance statement
5. Wait for reconciliation to complete
6. Note the `runId` from the response or UI

#### Step 2: Verify Run Creation
```bash
# Using curl or API client
curl -X GET http://localhost:5000/api/claim-reconciliation/runs/:runId \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

Expected: Run details returned with matched claims and remittances

#### Step 3: Verify Data Relationships
Check that data exists in all related tables:
```sql
-- Check the run
SELECT * FROM claim_recon_runs WHERE id = :runId;

-- Check claims
SELECT * FROM claim_recon_claims WHERE run_id = :runId;

-- Check remittances
SELECT * FROM claim_recon_remittances WHERE run_id = :runId;

-- Check run_claims join table (with matched_remittance_id references)
SELECT * FROM claim_recon_run_claims WHERE run_id = :runId AND matched_remittance_id IS NOT NULL;
```

#### Step 4: Test Deletion (Main Test)
```bash
# Delete the run via API
curl -X DELETE http://localhost:5000/api/claim-reconciliation/runs/:runId \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Expected Result:**
- Status: 200 OK
- Response: `{ "success": true }`
- No FK constraint error

#### Step 5: Verify Cleanup
Check that all related data has been properly cleaned up:

```sql
-- Run should be deleted
SELECT * FROM claim_recon_runs WHERE id = :runId;
-- Expected: 0 rows

-- Claims for this run should be deleted
SELECT * FROM claim_recon_claims WHERE run_id = :runId;
-- Expected: 0 rows

-- Remittances for this run should be deleted
SELECT * FROM claim_recon_remittances WHERE run_id = :runId;
-- Expected: 0 rows

-- Join table entries should be deleted (CASCADE)
SELECT * FROM claim_recon_run_claims WHERE run_id = :runId;
-- Expected: 0 rows
```

### Test Cases

#### Test Case 1: Delete Run with Matched Remittances (Primary Test)
**Scenario:** Delete a run that has claims matched to remittances
**Expected:** Deletion succeeds without FK errors

#### Test Case 2: Delete Run with No Matches
**Scenario:** Delete a run where no claims were matched
**Expected:** Deletion succeeds

#### Test Case 3: Delete Run with Partial Matches
**Scenario:** Delete a run with both matched and unmatched claims
**Expected:** Deletion succeeds

#### Test Case 4: Transaction Rollback
**Scenario:** Simulate a failure during deletion (e.g., by manually interrupting)
**Expected:** Either all data is deleted or none (transaction atomicity)

### Manual Testing via UI

1. **Login** to the application as an admin/staff user
2. **Navigate** to Claim Reconciliation → Runs
3. **Select** a run from the list
4. **Click** the "Delete" button (typically a trash icon)
5. **Confirm** the deletion in the confirmation dialog
6. **Verify** the run is removed from the list
7. **Check** that no error toast/notification appears

### Expected Behavior

#### ✅ Success Indicators
- API returns `{ "success": true }`
- No FK constraint error in logs or response
- Run is removed from the runs list
- All related data is cleaned up
- Transaction completes successfully

#### ❌ Failure Indicators (Should NOT Occur)
- FK constraint violation error
- Run still appears in the list
- Orphaned records in related tables
- Transaction rollback without cleanup

## Rollback Plan

If issues occur after deployment:

1. **Code Rollback:** Revert the changes to `service.ts`
2. **Database Rollback:** Run this SQL to restore original constraint:
```sql
ALTER TABLE claim_recon_run_claims 
  DROP CONSTRAINT IF EXISTS claim_recon_run_claims_matched_remittance_id_fkey;

ALTER TABLE claim_recon_run_claims 
  ADD CONSTRAINT claim_recon_run_claims_matched_remittance_id_fkey
  FOREIGN KEY (matched_remittance_id) 
  REFERENCES claim_recon_remittances(id);
```

## Notes

- The migration is idempotent and can be safely re-run
- The code change provides double protection (explicit nullify + FK policy)
- All operations are transactional to ensure data consistency
- The fix allows remittances to be deleted without blocking on run_claims references

## Contact

For issues or questions about this fix, contact the development team or refer to the GitHub issue.

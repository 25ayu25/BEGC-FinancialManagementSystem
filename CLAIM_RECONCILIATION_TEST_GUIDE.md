# Claim Reconciliation API Test Guide

## Overview
This guide provides instructions for manually testing the Claim Reconciliation API endpoints.

## Prerequisites
- Access to the production environment: https://bgc-financialmanagementsystem.onrender.com
- Frontend application: https://finance.bahrelghazalclinic.com
- Valid user credentials for authentication
- Sample Excel files for claims and remittance

## Available Endpoints

### 1. GET /api/claim-reconciliation/runs
**Purpose:** List all reconciliation runs

**Test Instructions:**
```bash
# Using curl (requires authentication cookie or X-Session-Token header)
curl -X GET https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/runs \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: <your-session-token>" \
  --verbose

# Expected Response:
# Status: 200 OK
# Body: [] (empty array if no runs) or array of run objects
```

**Expected Response Format:**
```json
[
  {
    "id": 1,
    "providerName": "CIC",
    "periodYear": 2024,
    "periodMonth": 11,
    "createdAt": "2024-11-06T...",
    "totalClaimRows": 100,
    "totalRemittanceRows": 95,
    "autoMatched": 85,
    "partialMatched": 8,
    "manualReview": 7
  }
]
```

### 2. GET /api/claim-reconciliation/runs/:id
**Purpose:** Get details of a specific reconciliation run

**Test Instructions:**
```bash
# Replace :id with actual run ID
curl -X GET https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/runs/1 \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: <your-session-token>" \
  --verbose

# Expected Response:
# Status: 200 OK
# Body: Run object with details
```

### 3. POST /api/claim-reconciliation/upload
**Purpose:** Upload and process claim reconciliation files

**Test Instructions:**
```bash
# Using curl with multipart form data
curl -X POST https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/upload \
  -H "X-Session-Token: <your-session-token>" \
  -F "claimsFile=@/path/to/claims.xlsx" \
  -F "remittanceFile=@/path/to/remittance.xlsx" \
  -F "providerName=CIC" \
  -F "periodYear=2024" \
  -F "periodMonth=11" \
  --verbose

# Expected Response:
# Status: 200 OK
# Body: Success response with runId and summary
```

**Expected Response Format:**
```json
{
  "success": true,
  "runId": 1,
  "summary": {
    "autoMatched": 85,
    "partialMatched": 8,
    "manualReview": 7,
    "totalClaims": 100,
    "totalRemittances": 95
  }
}
```

### 4. POST /api/claim-reconciliation/run
**Purpose:** Alias for /upload endpoint (same functionality)

**Test Instructions:**
Same as POST /upload above, but use `/run` instead of `/upload`:
```bash
curl -X POST https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/run \
  -H "X-Session-Token: <your-session-token>" \
  -F "claimsFile=@/path/to/claims.xlsx" \
  -F "remittanceFile=@/path/to/remittance.xlsx" \
  -F "providerName=CIC" \
  -F "periodYear=2024" \
  -F "periodMonth=11" \
  --verbose
```

## Frontend Testing

### Test from Frontend Application
1. **Navigate to Claim Reconciliation page:**
   - Go to https://finance.bahrelghazalclinic.com
   - Log in with valid credentials
   - Navigate to "Claim Reconciliation" from the sidebar

2. **Test GET /runs endpoint:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - The page should automatically fetch reconciliation runs
   - Verify:
     - Request to `/api/claim-reconciliation/runs` shows status 200
     - Response is valid JSON (not HTML error page)
     - No CORS errors in console

3. **Test POST /upload endpoint:**
   - Select insurance provider (e.g., CIC)
   - Choose period year and month
   - Upload both Claims Submitted and Remittance Advice Excel files
   - Click "Upload & Reconcile"
   - Verify:
     - Request to `/api/claim-reconciliation/upload` shows status 200
     - Response contains `runId` and `summary` fields
     - No CORS errors in console
     - No JSON parse errors
     - Success toast notification appears

## Error Cases to Test

### 1. Missing Authentication
```bash
# Should return 401 Unauthorized
curl -X GET https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/runs
```

**Expected Response:**
```json
{
  "error": "Authentication required"
}
```

### 2. Missing Required Fields
```bash
# POST without required fields
curl -X POST https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/upload \
  -H "X-Session-Token: <your-session-token>" \
  -F "claimsFile=@/path/to/claims.xlsx"
```

**Expected Response:**
```json
{
  "error": "Both claimsFile and remittanceFile are required"
}
```

### 3. Invalid File Type
```bash
# POST with non-Excel file
curl -X POST https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/upload \
  -H "X-Session-Token: <your-session-token>" \
  -F "claimsFile=@/path/to/file.txt" \
  -F "remittanceFile=@/path/to/file.pdf" \
  -F "providerName=CIC" \
  -F "periodYear=2024" \
  -F "periodMonth=11"
```

**Expected Response:**
```json
{
  "error": "Invalid file type. Only Excel files (.xlsx, .xls) are allowed."
}
```

## CORS Verification

### Check CORS Headers
```bash
# OPTIONS preflight request
curl -X OPTIONS https://bgc-financialmanagementsystem.onrender.com/api/claim-reconciliation/runs \
  -H "Origin: https://finance.bahrelghazalclinic.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Session-Token" \
  --verbose
```

**Expected Headers:**
- `Access-Control-Allow-Origin: https://finance.bahrelghazalclinic.com`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS, PUT`
- `Access-Control-Allow-Headers: Content-Type, X-Session-Token, Authorization`
- `Access-Control-Allow-Credentials: true`

## Server Logs

Check Render logs for the following log messages confirming router registration:
```
[express] Registering claim reconciliation router at /api/claim-reconciliation
[express] Claim reconciliation router registered successfully
```

## Troubleshooting

### 404 Not Found
- Verify the router is registered before catch-all handlers
- Check server logs for router registration messages
- Ensure the base path is `/api/claim-reconciliation`

### CORS Errors
- Verify `ALLOWED_ORIGINS` environment variable includes `https://finance.bahrelghazalclinic.com`
- Check that preflight OPTIONS requests return 204 No Content
- Ensure credentials are included in requests

### JSON Parse Errors
- All error responses should be JSON, not HTML
- Check that error handler middleware returns `res.status().json()`
- Verify no HTML error pages are being returned

## Notes
- Both `/upload` and `/run` endpoints are functionally identical
- All endpoints require authentication via cookie or X-Session-Token header
- File size limit: 10MB per file
- Supported file types: .xlsx, .xls

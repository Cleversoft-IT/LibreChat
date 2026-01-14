# Product Reorder Scanner Tool

## Overview
The Product Reorder Scanner tool has been successfully created to scan product inventory levels and determine which products need to be reordered today based on sales history, current stock, and incoming orders.

## Files Created/Modified

### 1. New Tool File
- **File**: `api/app/clients/tools/structured/ProductReorderScanner.js`
- **Purpose**: Main tool implementation
- **Features**:
  - Fetches sales data from SQL database via middleware API
  - Retrieves on-hand stock levels by warehouse
  - Checks incoming orders
  - Calculates reorder points using the same algorithm as ReorderCalculator
  - Returns list of products that need reordering

### 2. Environment Configuration
- **File**: `.env`
- **Added**:
  ```env
  # Middleware GO API (for SQL queries)
  MIDDLEWARE_GO_API_URL=https://middlewarego.formaaquae.cleversoft.it
  MIDDLEWARE_GO_BEARER_TOKEN=
  ```
- **Action Required**: Add your Bearer token to `MIDDLEWARE_GO_BEARER_TOKEN`

### 3. Tool Registration
- Already registered in `api/app/clients/tools/index.js` (line 28, 57)
- Already registered in `api/app/clients/tools/util/handleTools.js` (line 51, 210)
- Already configured in `api/app/clients/tools/manifest.json` (lines 274-280)

## Tool Usage

### Input Schema
```json
{
  "productCodes": ["PROD001", "PROD002"],  // Optional: Array of product codes. If not provided, scans all VS% products
  "productPattern": "VS%",                 // Optional: Default "VS%" - SQL LIKE pattern for auto-fetching products
  "warehouse": "rogno",                    // Optional: Default "rogno"
  "historicalMonths": 12,                  // Optional: Default 12
  "leadTime": 80,                         // Optional: Default 80 days
  "serviceLevel": 0.95,                   // Optional: Default 0.95
  "annualGrowth": 0.10,                   // Optional: Default 0 (10% growth)
  "minOperationalStock": 5,               // Optional: Default 5
  "weightingFactor": 0.85                 // Optional: Default 0.85
}
```

**Note**: If `productCodes` is not provided or is empty, the tool will automatically fetch all product codes matching the `productPattern` (default: "VS%") and scan them.

### Output Format
```json
{
  "scannedProducts": 2,
  "productsNeedingReorder": 1,
  "products": [
    {
      "productCode": "PROD001",
      "description": "Product Name",
      "reorderPoint": 150,
      "reorderQuantity": 75,
      "reorderDate": "2024-03-15",
      "totalForecast": 120,
      "safetyStock": 30,
      "availableStock": 75,
      "onHandStock": 50,
      "incomingStock": 25,
      "needsReorder": true
    }
  ],
  "errors": []
}
```

## SQL Queries Used

### 1. Product Code Auto-Fetch Query (when productCodes not provided)
```sql
SELECT CODICE
FROM art
WHERE CODICE LIKE 'VS%'
```

### 2. Sales Data Query
```sql
SELECT
  YEAR(ovt.DATA_DOCUMENTO) AS anno,
  MONTH(ovt.DATA_DOCUMENTO) AS mese_num,
  DATE_FORMAT(ovt.DATA_DOCUMENTO, '%Y-%m') AS mese,
  SUM(ovr.QUANTITA) AS quantita_totale_venduta
FROM ovr
JOIN ovt ON ovr.PROGRESSIVO = ovt.PROGRESSIVO
WHERE
  ovr.ART_CODICE = '{productCode}'
  AND ovt.DATA_DOCUMENTO >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL {months} MONTH), '%Y-%m-01')
  AND ovt.CLI_CODICE NOT IN ('00000638', '00001680', '00000656')
GROUP BY anno, mese_num, DATE_FORMAT(ovt.DATA_DOCUMENTO, '%Y-%m')
ORDER BY anno DESC, mese_num DESC
```

### 3. On-Hand Stock Query
```sql
SELECT
  art.CODICE,
  art.DESCRIZIONE1,
  tma.DESCRIZIONE AS DEPOSITO,
  (mag.ESISTENZA - mag.IMPEGNATO) AS Disponibilita_Reale
FROM art
JOIN mag ON art.CODICE = mag.ART_CODICE
JOIN tma ON mag.TMA_CODICE = tma.CODICE
WHERE
  art.CODICE = '{productCode}'
  AND LOWER(tma.DESCRIZIONE) LIKE LOWER('%{warehouse}%')
  AND (mag.ESISTENZA - mag.IMPEGNATO) > 0
GROUP BY art.CODICE, art.DESCRIZIONE1, tma.DESCRIZIONE, mag.ESISTENZA, mag.IMPEGNATO
```

### 4. Incoming Orders Query
```sql
SELECT
  oar.PROGRESSIVO,
  oar.RIGA,
  oar.QUANTITA,
  oar.DATA_CONSEGNA,
  DATE_FORMAT(oar.DATA_CONSEGNA, '%Y-%m') AS mese
FROM oar
JOIN oat ON oar.PROGRESSIVO = oat.PROGRESSIVO
WHERE
  oar.ART_CODICE = '{productCode}'
  AND (oar.QUANTITA - oar.QUANTITA_EVASA) > 0
  AND oat.TMA_CODICE != 'OEM'
```

## Calculation Logic

The tool uses the same sophisticated reorder calculation algorithm as the ReorderCalculator:

1. **Historical Data Analysis**: Groups sales data by month-of-year with exponential weighting
2. **Weighted Averages**: Recent data is weighted more heavily using configurable weighting factor
3. **Seasonal Patterns**: Tracks monthly sales patterns and standard deviations
4. **Growth Adjustment**: Applies annual growth rate to forecasts
5. **Safety Stock**: Calculates using Z-scores for specified service level
6. **Lead Time Consideration**: Calculates demand during lead time period
7. **Available Stock**: Considers current stock + incoming orders
8. **Reorder Quantity**: Calculates difference between reorder point and available stock

## Docker Build Error

The error you encountered is **not related to the code**:

```
npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write
```

This is a **disk space issue**. To resolve:

1. Check disk space: `df -h`
2. Clean Docker: `docker system prune -a`
3. Remove unused images: `docker image prune -a`
4. Clean npm cache: `npm cache clean --force`
5. Retry build after freeing space

## Next Steps

1. **Add Bearer Token**: Update `.env` file with `MIDDLEWARE_GO_BEARER_TOKEN` value
2. **Free Disk Space**: Clean up system to allow Docker build
3. **Rebuild**: Run `docker compose -f ./deploy-compose.yml build`
4. **Test**: Use the tool in LibreChat with example product codes

## Example Usage in LibreChat

### Scan Specific Products
```
"Scan products ABC123, DEF456, and GHI789 to see which need reordering.
Use 15 months of history and assume 8% annual growth."
```

### Scan All VS Products (Auto-Fetch)
```
"Check all VS products to see which ones need reordering today."
```

### Scan Products with Custom Pattern
```
"Scan all products starting with 'FA' and tell me which need reordering."
```
In this case, provide: `{"productPattern": "FA%"}`

The AI will process these requests using the product_reorder_scanner tool and return a detailed report of which products need ordering.

## Tool Features

✅ Fetches real-time data from SQL database via API
✅ Uses Bearer token authentication
✅ **Auto-fetches product codes** when none provided (default: all VS% products)
✅ Calculates reorder points using proven ReorderCalculator algorithm
✅ Considers seasonal patterns and growth trends
✅ Accounts for current stock and incoming orders
✅ Configurable parameters (lead time, service level, etc.)
✅ **Customizable product pattern** for auto-fetch (e.g., "FA%", "VS%")
✅ Returns only products that actually need reordering
✅ Error handling for individual product failures
✅ Handles large product catalogs efficiently

## Support

The tool is fully integrated and ready to use once:
1. Bearer token is configured
2. Docker build completes successfully
3. LibreChat is restarted

No additional code changes are required.
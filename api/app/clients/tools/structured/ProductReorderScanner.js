// ProductReorderScanner.js
// A tool for scanning products and determining which need reordering today
const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');

// Z-score lookup table for service levels
const zTable = {
  0.90: 1.28,
  0.95: 1.645,
  0.98: 2.055,
  0.99: 2.326
};

function getZValue(serviceLevel) {
  return zTable[serviceLevel] || zTable[0.95];
}

/**
 * Parse a "YYYY-MM" string into { year, monthIndex } where monthIndex is 0-based
 */
function parseYearMonth(ym) {
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  return { year, monthIndex };
}

/**
 * Convert "YYYY-MM" to "absolute month" (year*12 + monthIndex)
 */
function monthToAbsolute(ym) {
  const { year, monthIndex } = parseYearMonth(ym);
  return year * 12 + monthIndex;
}

/**
 * Add integer months to { year, monthIndex }, returning a new object
 */
function addMonths(yearMonth, numMonths) {
  const newYear = yearMonth.year + Math.floor((yearMonth.monthIndex + numMonths) / 12);
  const newMonthIndex = ((yearMonth.monthIndex + numMonths) % 12 + 12) % 12;
  return { year: newYear, monthIndex: newMonthIndex };
}

/**
 * Extract just the month index (0-11) from a year-month object
 */
function monthIndexOnly(yearMonth) {
  return yearMonth.monthIndex;
}

class ProductReorderScanner extends Tool {
  constructor() {
    super();
    this.name = 'product_reorder_scanner';
    this.description = `
      Scan products to determine which need reordering today based on sales history, current stock, and incoming orders.
      Input must be a JSON object like:
      {
        productCodes: ["PROD001", "PROD002", ...] (optional, if not provided will scan all VS products),
        productPattern: string (optional, default="VS%", pattern for auto-fetching product codes),
        warehouse: string (optional, default="rogno"),
        historicalMonths: number (optional, default=12, months of sales history to analyze),
        leadTime: number (days, optional, default=80),
        serviceLevel: number (0-1, optional, default=0.95),
        annualGrowth: number (decimal, e.g. 0.10 for +10% yoy, optional, default=0),
        minOperationalStock: number (optional, default=5),
        weightingFactor: number (0-1, optional, default=0.85),
        excludeCustomers: ["00000638", "00001680", ...] (optional, array of customer codes to exclude from sales analysis),
        excludeProducts: ["PROD001", "PROD002", ...] (optional, array of product codes to exclude from scanning)
      }
      Returns a list of products that need to be ordered today with reorder quantities and dates.
    `;

    this.description_for_model = this.description;

    this.schema = z.object({
      productCodes: z.array(z.string()).optional().describe('Array of product codes to scan. If not provided, will scan all products matching productPattern'),
      productPattern: z.string().optional().default('VS%').describe('SQL LIKE pattern for auto-fetching product codes when productCodes not provided'),
      warehouse: z.string().optional().default('rogno').describe('Warehouse name (default: rogno)'),
      historicalMonths: z.number().optional().default(12).describe('Number of months of sales history to analyze'),
      leadTime: z.number().optional().default(80).describe('Lead time in days'),
      serviceLevel: z.number().min(0).max(1).optional().default(0.95).describe('Service level (0-1)'),
      annualGrowth: z.number().optional().default(0).describe('Annual growth rate (decimal)'),
      minOperationalStock: z.number().optional().default(5).describe('Minimum operational stock level'),
      weightingFactor: z.number().min(0).max(1).optional().default(0.85).describe('Weighting factor for recent data'),
      excludeCustomers: z.array(z.string()).optional().default(['00000638', '00001680', '00000656']).describe('Array of customer codes to exclude from sales analysis (default: excludes 00000638, 00001680, 00000656)'),
      excludeProducts: z.array(z.string()).optional().default([]).describe('Array of product codes to exclude from scanning')
    });

    // Get API configuration from environment
    this.apiUrl = process.env.MIDDLEWARE_GO_API_URL;
    this.bearerToken = process.env.MIDDLEWARE_GO_BEARER_TOKEN;

    if (!this.apiUrl || !this.bearerToken) {
      logger.warn('[ProductReorderScanner] Missing MIDDLEWARE_GO_API_URL or MIDDLEWARE_GO_BEARER_TOKEN environment variables');
    }
  }

  /**
   * Execute a SQL query via the middleware API
   */
  async executeSQLQuery(query) {
    try {
      const response = await fetch(`${this.apiUrl}/executeSelect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.bearerToken}`
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`SQL query failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      logger.error(`[ProductReorderScanner] SQL query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch all product codes matching a pattern
   */
  async fetchProductCodes(pattern) {
    const query = `SELECT CODICE FROM art WHERE CODICE LIKE '${pattern}'`;
    
    try {
      const results = await this.executeSQLQuery(query);
      return results.map(row => row.CODICE);
    } catch (error) {
      logger.error(`[ProductReorderScanner] Error fetching product codes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch sales data for a product
   */
  async fetchSalesData(productCode, historicalMonths, excludeCustomers = ['00000638', '00001680', '00000656']) {
    // Build the NOT IN clause for excluded customers
    const excludeClause = excludeCustomers.length > 0
      ? `AND ovt.CLI_CODICE NOT IN (${excludeCustomers.map(c => `'${c}'`).join(', ')})`
      : '';

    const query = `
      SELECT
        YEAR(ovt.DATA_DOCUMENTO) AS anno,
        MONTH(ovt.DATA_DOCUMENTO) AS mese_num,
        DATE_FORMAT(ovt.DATA_DOCUMENTO, '%Y-%m') AS mese,
        SUM(ovr.QUANTITA) AS quantita_totale_venduta
      FROM ovr
      JOIN ovt ON ovr.PROGRESSIVO = ovt.PROGRESSIVO
      WHERE
        ovr.ART_CODICE = '${productCode}'
        AND ovt.DATA_DOCUMENTO >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ${historicalMonths} MONTH), '%Y-%m-01')
        ${excludeClause}
      GROUP BY
        anno,
        mese_num,
        DATE_FORMAT(ovt.DATA_DOCUMENTO, '%Y-%m')
      ORDER BY
        anno DESC,
        mese_num DESC
    `;

    const results = await this.executeSQLQuery(query);
    return results.map(row => ({
      month: row.mese,
      quantity: parseFloat(row.quantita_totale_venduta) || 0
    }));
  }

  /**
   * Fetch on-hand stock for a product
   */
  async fetchOnHandStock(productCode, warehouse) {
    const query = `
      SELECT
        art.CODICE,
        art.DESCRIZIONE1,
        tma.DESCRIZIONE AS DEPOSITO,
        (mag.ESISTENZA - mag.IMPEGNATO) AS Disponibilita_Reale
      FROM art
      JOIN mag ON art.CODICE = mag.ART_CODICE
      JOIN tma ON mag.TMA_CODICE = tma.CODICE
      WHERE
        art.CODICE = '${productCode}'
        AND LOWER(tma.DESCRIZIONE) LIKE LOWER('%${warehouse}%')
        AND (mag.ESISTENZA - mag.IMPEGNATO) > 0
      GROUP BY
        art.CODICE,
        art.DESCRIZIONE1,
        tma.DESCRIZIONE,
        mag.ESISTENZA,
        mag.IMPEGNATO
    `;

    const results = await this.executeSQLQuery(query);
    if (results.length === 0) {
      return { stock: 0, description: '' };
    }

    const totalStock = results.reduce((sum, row) => sum + (parseFloat(row.Disponibilita_Reale) || 0), 0);
    return {
      stock: totalStock,
      description: results[0].DESCRIZIONE1 || ''
    };
  }

  /**
   * Fetch incoming orders for a product
   */
  async fetchIncomingOrders(productCode) {
    const query = `
      SELECT
        oar.PROGRESSIVO,
        oar.RIGA,
        oar.QUANTITA,
        oar.DATA_CONSEGNA,
        DATE_FORMAT(oar.DATA_CONSEGNA, '%Y-%m') AS mese
      FROM oar
      JOIN oat ON oar.PROGRESSIVO = oat.PROGRESSIVO
      WHERE
        oar.ART_CODICE = '${productCode}'
        AND (oar.QUANTITA - oar.QUANTITA_EVASA) > 0
        AND oat.TMA_CODICE != 'OEM'
    `;

    const results = await this.executeSQLQuery(query);
    
    // Group by month
    const ordersByMonth = {};
    results.forEach(row => {
      const month = row.mese;
      const quantity = parseFloat(row.QUANTITA) || 0;
      if (month) {
        ordersByMonth[month] = (ordersByMonth[month] || 0) + quantity;
      }
    });

    return Object.keys(ordersByMonth).map(month => ({
      month,
      quantity: ordersByMonth[month]
    }));
  }

  /**
   * Calculate reorder point using the same logic as ReorderCalculator
   */
  calculateReorderPoint(salesData, onHandStock, incomingOrders, params) {
    const {
      leadTime,
      serviceLevel,
      annualGrowth,
      minOperationalStock,
      weightingFactor
    } = params;

    if (!salesData.length) {
      return null;
    }

    // Find the most recent month
    let maxAbs = -Infinity;
    for (const record of salesData) {
      const abs = monthToAbsolute(record.month);
      if (abs > maxAbs) {
        maxAbs = abs;
      }
    }

    // Group data by month-of-year with exponential weights
    const dataByMonth = Array.from({ length: 12 }, () => ({ values: [] }));

    for (const record of salesData) {
      const abs = monthToAbsolute(record.month);
      const monthsAgo = maxAbs - abs;
      const mIndex = parseYearMonth(record.month).monthIndex;
      const weight = Math.pow(weightingFactor, monthsAgo);

      dataByMonth[mIndex].values.push({
        quantity: record.quantity,
        weight: weight
      });
    }

    // Compute weighted average & std dev for each month
    const avgByMonth = Array(12).fill(0);
    const stdByMonth = Array(12).fill(0);

    for (let m = 0; m < 12; m++) {
      const arr = dataByMonth[m].values;
      if (!arr.length) {
        continue;
      }

      const n = arr.length;
      let weightedSum = 0;
      let weightSum = 0;
      let weightedSqSum = 0;

      for (let i = 0; i < n; i++) {
        const w = arr[i].weight;
        weightedSum += arr[i].quantity * w;
        weightSum += w;
        weightedSqSum += arr[i].quantity * arr[i].quantity * w;
      }

      const mean = weightedSum / weightSum;
      avgByMonth[m] = mean;

      if (n > 1) {
        const variance = (weightedSqSum / weightSum) - (mean * mean);
        stdByMonth[m] = Math.sqrt(Math.max(0, variance));

        // Cap standard deviation at 50% of mean
        if (stdByMonth[m] > mean * 0.5 && mean > 0) {
          stdByMonth[m] = mean * 0.5;
        }
      }
    }

    // Convert leadTime to months
    const leadTimeMonths = leadTime / 30.0;

    // Determine current month and forecast start
    let latestYear = -Infinity;
    let latestMIndex = -Infinity;
    for (const { month } of salesData) {
      const p = parseYearMonth(month);
      if (p.year > latestYear) {
        latestYear = p.year;
        latestMIndex = p.monthIndex;
      } else if (p.year === latestYear && p.monthIndex > latestMIndex) {
        latestMIndex = p.monthIndex;
      }
    }
    const currentYM = { year: latestYear, monthIndex: latestMIndex };
    const forecastStartYM = addMonths(currentYM, 1);

    // Calculate monthly growth factor
    const monthlyGrowthFactor = (1 + annualGrowth) ** (1 / 12) - 1;

    // Split leadTimeMonths into full + fractional
    const fullMonths = Math.floor(leadTimeMonths);
    const fractionalPart = leadTimeMonths - fullMonths;

    let totalForecast = 0;
    let totalVariance = 0;

    // Calculate demand for each full month
    for (let i = 0; i < fullMonths; i++) {
      const pointerYM = addMonths(forecastStartYM, i);
      const mIndex = monthIndexOnly(pointerYM);

      const baseAvg = avgByMonth[mIndex];
      const baseStd = stdByMonth[mIndex];

      const growthFactor = (1 + monthlyGrowthFactor) ** i;
      const scaledAvg = baseAvg * growthFactor;
      const scaledStd = baseStd * Math.sqrt(growthFactor);

      totalForecast += scaledAvg;
      totalVariance += scaledStd ** 2;
    }

    // Handle partial month
    if (fractionalPart > 0) {
      const pointerYM = addMonths(forecastStartYM, fullMonths);
      const mIndex = monthIndexOnly(pointerYM);
      const baseAvg = avgByMonth[mIndex];
      const baseStd = stdByMonth[mIndex];

      const offset = fullMonths + fractionalPart;
      const growthFactor = (1 + monthlyGrowthFactor) ** offset;

      const scaledAvg = baseAvg * growthFactor;
      const scaledStd = baseStd * Math.sqrt(growthFactor);

      totalForecast += fractionalPart * scaledAvg;
      totalVariance += (fractionalPart ** 2) * (scaledStd ** 2);
    }

    const totalStdDev = Math.sqrt(totalVariance);

    // Calculate safety stock
    const zVal = getZValue(serviceLevel);
    const dampingFactor = Math.min(1, 1 / (1 + totalStdDev / (totalForecast || 1) * 2));
    let finalSafetyStock = zVal * totalStdDev * dampingFactor;

    const maxSafetyStockFactor = 0.5;
    const maxSafetyStock = totalForecast * maxSafetyStockFactor;

    if (finalSafetyStock > maxSafetyStock && totalForecast > 0) {
      finalSafetyStock = maxSafetyStock;
    }

    if (finalSafetyStock < minOperationalStock) {
      finalSafetyStock = minOperationalStock;
    }

    // Calculate reorder point
    const reorderPoint = totalForecast + finalSafetyStock;

    // Calculate expected incoming stock (all incoming orders, not just within lead time)
    let incomingStock = 0;
    if (incomingOrders && incomingOrders.length > 0) {
      // Sum ALL incoming orders, including those arriving after the lead time
      incomingStock = incomingOrders.reduce((sum, order) => {
        return sum + order.quantity;
      }, 0);
    }

    // Calculate available stock (current + incoming)
    const availableStock = onHandStock + incomingStock;

    // Calculate reorder quantity
    const reorderQuantity = Math.max(0, Math.ceil(reorderPoint - availableStock));

    // Calculate reorder date
    const today = new Date();
    const reorderDate = new Date(today);
    reorderDate.setDate(reorderDate.getDate() + Math.ceil(leadTime));

    return {
      reorderPoint: Math.ceil(reorderPoint),
      reorderQuantity,
      reorderDate: reorderDate.toISOString().split('T')[0],
      totalForecast: Math.ceil(totalForecast),
      safetyStock: Math.ceil(finalSafetyStock),
      availableStock: Math.ceil(availableStock),
      onHandStock: Math.ceil(onHandStock),
      incomingStock: Math.ceil(incomingStock),
      needsReorder: reorderQuantity > 0
    };
  }

  async _call(input, _runManager) {
    try {
      logger.info(`[ProductReorderScanner] Scanning products: ${JSON.stringify(input)}`);

      const {
        productCodes: inputProductCodes,
        productPattern,
        warehouse,
        historicalMonths,
        leadTime,
        serviceLevel,
        annualGrowth,
        minOperationalStock,
        weightingFactor,
        excludeCustomers,
        excludeProducts
      } = this.schema.parse(input);

      // If no product codes provided, fetch all matching the pattern
      let productCodes = inputProductCodes;
      if (!productCodes || productCodes.length === 0) {
        logger.info(`[ProductReorderScanner] No product codes provided, fetching all products matching pattern: ${productPattern}`);
        productCodes = await this.fetchProductCodes(productPattern);
        logger.info(`[ProductReorderScanner] Found ${productCodes.length} products matching pattern`);
        
        if (productCodes.length === 0) {
          return JSON.stringify({
            error: `No products found matching pattern: ${productPattern}`,
            scannedProducts: 0,
            productsNeedingReorder: 0,
            products: []
          }, null, 2);
        }
      }

      // Filter out excluded products
      if (excludeProducts && excludeProducts.length > 0) {
        const originalCount = productCodes.length;
        productCodes = productCodes.filter(code => !excludeProducts.includes(code));
        logger.info(`[ProductReorderScanner] Excluded ${originalCount - productCodes.length} products, ${productCodes.length} remaining`);
      }

      // Log excluded customers
      if (excludeCustomers && excludeCustomers.length > 0) {
        logger.info(`[ProductReorderScanner] Excluding customers from sales analysis: ${excludeCustomers.join(', ')}`);
      }

      const results = [];

      for (const productCode of productCodes) {
        try {
          logger.info(`[ProductReorderScanner] Processing product: ${productCode}`);

          // Fetch data for this product
          const [salesData, stockData, incomingOrders] = await Promise.all([
            this.fetchSalesData(productCode, historicalMonths, excludeCustomers),
            this.fetchOnHandStock(productCode, warehouse),
            this.fetchIncomingOrders(productCode)
          ]);

          // Calculate reorder point
          const calculation = this.calculateReorderPoint(
            salesData,
            stockData.stock,
            incomingOrders,
            {
              leadTime,
              serviceLevel,
              annualGrowth,
              minOperationalStock,
              weightingFactor
            }
          );

          if (calculation && calculation.needsReorder) {
            results.push({
              productCode,
              description: stockData.description,
              ...calculation
            });
          }

          logger.info(`[ProductReorderScanner] Product ${productCode}: Needs reorder = ${calculation?.needsReorder || false}`);
        } catch (error) {
          logger.error(`[ProductReorderScanner] Error processing product ${productCode}: ${error.message}`);
          results.push({
            productCode,
            error: error.message
          });
        }
      }

      // Filter only products that need reordering
      const productsNeedingReorder = results.filter(r => r.needsReorder && !r.error);

      const response = {
        scannedProducts: productCodes.length,
        productsNeedingReorder: productsNeedingReorder.length,
        products: productsNeedingReorder,
        errors: results.filter(r => r.error)
      };

      logger.info(`[ProductReorderScanner] Scan complete: ${productsNeedingReorder.length}/${productCodes.length} products need reordering`);

      return JSON.stringify(response, null, 2);
    } catch (error) {
      logger.error(`[ProductReorderScanner] Error: ${error.message}`);
      return JSON.stringify({
        error: error.message,
        scannedProducts: 0,
        productsNeedingReorder: 0,
        products: []
      }, null, 2);
    }
  }
}

module.exports = ProductReorderScanner;
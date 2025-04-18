// ReorderCalculator.js
// A tool for calculating reorder quantities and dates using weighted historical data
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
 * This helps in calculating time differences between months
 */
function monthToAbsolute(ym) {
  const { year, monthIndex } = parseYearMonth(ym);
  return year * 12 + monthIndex;
}

/**
 * Add integer months to { year, monthIndex }, returning a new object
 * Handles month overflow/underflow correctly
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

class ReorderCalculator extends Tool {
  constructor() {
    super();
    this.name = 'reorder_calculator';
    this.description = `
      Calculate reorder quantity & reorder date using monthly seasonality + optional growth.
      Input must be a JSON object like:
      {
        salesData: [{ month: "YYYY-MM", quantity: number }, ...],
        leadTime: number (days, optional, default=80),
        serviceLevel: number (0-1, optional, default=0.95),
        onHandStock: number (optional, default=0),
        annualGrowth: number (decimal, e.g. 0.10 for +10% yoy),
        safetyStock: number (optional, override),
        minOperationalStock: number (optional, default=5),
        incomingOrders: [{ month: "YYYY-MM", quantity: number }, ...] (optional),
        weightingFactor: number (0-1, optional, default=0.85, how much to weight recent data)
      }
    `;

    this.description_for_model = this.description;

    this.schema = z.object({
      salesData: z.array(
        z.object({
          month: z.string().describe('Month in YYYY-MM format'),
          quantity: z.number().describe('Quantity sold in that month')
        })
      ),
      leadTime: z.number().optional().default(80),
      serviceLevel: z.number().min(0).max(1).optional().default(0.95),
      onHandStock: z.number().optional().default(0),
      annualGrowth: z.number().optional().default(0)
        .describe('Decimal growth rate per year, e.g. 0.10 => +10% yoy, -0.05 => -5%.'),
      safetyStock: z.number().optional(),
      minOperationalStock: z.number().optional().default(5).describe('Minimum operational stock level'),
      incomingOrders: z.array(
        z.object({
          month: z.string().describe('Month in YYYY-MM format'),
          quantity: z.number().describe('Quantity to be received')
        })
      ).optional().default([]).describe('Expected incoming orders'),
      weightingFactor: z.number().min(0).max(1).optional().default(0.85)
        .describe('Factor to weight recent data (0-1). 0.85 means each month ago reduces weight by 15%')
    });
  }

  async _call(input, _runManager) {
    try {
      logger.info(`[ReorderCalculator] Calculating with weighted historical data (weight=${input.weightingFactor}): ${JSON.stringify(input)}`);

      // 1. Parse/validate input
      const {
        salesData,
        leadTime,
        serviceLevel,
        onHandStock,
        annualGrowth,
        safetyStock,
        minOperationalStock,
        incomingOrders,
        weightingFactor
      } = this.schema.parse(input);

      if (!salesData.length) {
        throw new Error('No sales data provided.');
      }

      // 2. Find the most recent month in the dataset to use as reference point
      let maxAbs = -Infinity;
      for (const record of salesData) {
        const abs = monthToAbsolute(record.month);
        if (abs > maxAbs) {
          maxAbs = abs;
        }
      }

      // 3. Group data by month-of-year (0..11), calculating exponential weights
      // based on how many months ago the data point is from the most recent
      const dataByMonth = Array.from({ length: 12 }, () => ({ values: [] }));

      for (const record of salesData) {
        const abs = monthToAbsolute(record.month);
        const monthsAgo = maxAbs - abs; // 0 = most recent
        const mIndex = parseYearMonth(record.month).monthIndex;

        // Apply exponential weighting: weightingFactor^monthsAgo
        const weight = Math.pow(weightingFactor, monthsAgo);

        dataByMonth[mIndex].values.push({
          quantity: record.quantity,
          weight: weight
        });
      }

      // 3. Compute average & std dev for each month-of-year
      const avgByMonth = Array(12).fill(0);
      const stdByMonth = Array(12).fill(0);

      for (let m = 0; m < 12; m++) {
        const arr = dataByMonth[m].values;
        if (!arr.length) {
          avgByMonth[m] = 0;
          stdByMonth[m] = 0;
          continue;
        }

        // Apply time-based weighting to the values
        const n = arr.length;
        let weightedSum = 0;
        let weightSum = 0;
        let weightedSqSum = 0;

        // Use the precomputed weights stored in arr[i].weight
        for (let i = 0; i < n; i++) {
          const w = arr[i].weight;
          weightedSum += arr[i].quantity * w;
          weightSum += w;
          weightedSqSum += arr[i].quantity * arr[i].quantity * w;
        }

        // Weighted mean
        const mean = weightedSum / weightSum;
        avgByMonth[m] = mean;

        // Weighted variance and std dev
        if (n > 1) {
          const variance = (weightedSqSum / weightSum) - (mean * mean);
          // Apply a square root transformation to reduce the effect of outliers
          stdByMonth[m] = Math.sqrt(Math.max(0, variance)); // ensure non-negative
          
          // Cap standard deviation at 50% of the mean to prevent excessive safety stock
          if (stdByMonth[m] > mean * 0.5 && mean > 0) {
            stdByMonth[m] = mean * 0.5;
          }
        } else {
          stdByMonth[m] = 0;
        }
      }

      // 5. Convert leadTime from days to months for calculations
      const leadTimeMonths = leadTime / 30.0;

      // 6. Determine the current month (last data point) and forecast start
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

      // 7. Calculate monthly growth factor if annual growth specified
      const monthlyGrowthFactor = (1 + annualGrowth) ** (1 / 12) - 1;

      // Split leadTimeMonths into full months + fractional part
      const fullMonths = Math.floor(leadTimeMonths);
      const fractionalPart = leadTimeMonths - fullMonths;

      let totalForecast = 0;
      let totalVariance = 0;

      // 8. Calculate demand for each full month in the lead time
      for (let i = 0; i < fullMonths; i++) {
        const pointerYM = addMonths(forecastStartYM, i);
        const mIndex = monthIndexOnly(pointerYM);

        const baseAvg = avgByMonth[mIndex];
        const baseStd = stdByMonth[mIndex];

        // Apply growth factor: (1 + monthlyGrowth)^monthsFromStart
        const growthFactor = (1 + monthlyGrowthFactor) ** i;
        const scaledAvg = baseAvg * growthFactor;
        // Scale standard deviation more conservatively than mean to prevent excessive safety stock
        // Square root scaling reduces the impact of growth on variance
        const scaledStd = baseStd * Math.sqrt(growthFactor);

        totalForecast += scaledAvg;
        totalVariance += scaledStd ** 2;
      }

      // 9. Handle partial month at end of lead time
      if (fractionalPart > 0) {
        const pointerYM = addMonths(forecastStartYM, fullMonths);
        const mIndex = monthIndexOnly(pointerYM);
        const baseAvg = avgByMonth[mIndex];
        const baseStd = stdByMonth[mIndex];

        const offset = fullMonths + fractionalPart;
        const growthFactor = (1 + monthlyGrowthFactor) ** offset;

        const scaledAvg = baseAvg * growthFactor;
        // Apply the same square root scaling for partial months
        const scaledStd = baseStd * Math.sqrt(growthFactor);

        totalForecast += fractionalPart * scaledAvg;
        totalVariance += (fractionalPart ** 2) * (scaledStd ** 2);
      }

      const totalStdDev = Math.sqrt(totalVariance);

      // 10. Calculate safety stock
      let finalSafetyStock = 0;
      if (typeof safetyStock === 'number') {
        // Use override if provided
        finalSafetyStock = safetyStock;
      } else {
        const zVal = getZValue(serviceLevel);
        
        // Apply a dampening factor to prevent excessive safety stock
        // This reduces the impact of high standard deviations
        const dampingFactor = Math.min(1, 1 / (1 + totalStdDev / (totalForecast || 1) * 2));
        
        // Calculate safety stock with the damping factor
        finalSafetyStock = zVal * totalStdDev * dampingFactor;
        
        // Add an upper limit as a percentage of total forecast
        const maxSafetyStockFactor = 0.5; // 50% of forecast
        const maxSafetyStock = totalForecast * maxSafetyStockFactor;
        
        if (finalSafetyStock > maxSafetyStock && totalForecast > 0) {
          finalSafetyStock = maxSafetyStock;
        }
      }
      // Apply minimum operational stock threshold
      if (finalSafetyStock < minOperationalStock) {
        finalSafetyStock = minOperationalStock;
      }

      // 8. Reorder Point
      const reorderPoint = totalForecast + finalSafetyStock;

      // 9. Calculate expected incoming stock during lead time
      let incomingStock = 0;
      if (incomingOrders && incomingOrders.length > 0) {
        // Get the date range for lead time
        const forecastEndYM = addMonths(forecastStartYM, Math.ceil(leadTimeMonths));
        
        // Sum quantities from orders that arrive within our lead time window
        incomingStock = incomingOrders.reduce((sum, order) => {
          const orderYM = parseYearMonth(order.month);
          // Check if order arrives between forecast start and end
          if (
            (orderYM.year > forecastStartYM.year || 
             (orderYM.year === forecastStartYM.year && orderYM.monthIndex >= forecastStartYM.monthIndex)) &&
            (orderYM.year < forecastEndYM.year || 
             (orderYM.year === forecastEndYM.year && orderYM.monthIndex <= forecastEndYM.monthIndex))
          ) {
            return sum + order.quantity;
          }
          return sum;
        }, 0);
      }

      // 10. Adjust effective stock by adding incoming orders
      const effectiveStock = onHandStock + incomingStock;

      // 11. Reorder Quantity - consider incoming stock
      let reorderQuantity = 0;
      if (effectiveStock < reorderPoint) {
        reorderQuantity = Math.ceil(reorderPoint - effectiveStock);
      }

      // 12. Simple reorder date heuristic
      //     If effectiveStock < reorderPoint => reorder now => "today"
      //     Otherwise, guess how many months until we dip below ROP
      let reorderDate = 'today';
      if (effectiveStock >= reorderPoint) {
        const nextMonthYM = addMonths(forecastStartYM, 0);
        const mIndex = monthIndexOnly(nextMonthYM);

        const baseAvg = avgByMonth[mIndex];
        if (baseAvg <= 0) {
          reorderDate = 'No reorder needed (zero demand?)';
        } else {
          const usedAvg = baseAvg;
          const diff = effectiveStock - reorderPoint;
          if (diff > 0) {
            const monthsUntilROP = diff / usedAvg;
            reorderDate = `in ~${monthsUntilROP.toFixed(1)} months`;
          } else {
            reorderDate = 'today';
          }
        }
      }

      // 13. Return results with incoming orders info
      // Calculate confidence based on number of data points
      const minDataPoints = 6;
      const maxDataPoints = 24;
      const minConfidence = 0.7;
      const maxConfidence = 1.0;
      
      const normalized = Math.min(Math.max((salesData.length - minDataPoints) / (maxDataPoints - minDataPoints), 0), 1);
      const confidence = minConfidence + (maxConfidence - minConfidence) * normalized;
      
      const result = {
        demandDuringLeadTime: totalForecast,
        reorderPoint,
        reorderQuantity,
        safetyStock: finalSafetyStock,
        currentStock: onHandStock,
        incomingStock,
        effectiveStock,
        reorderDate,
        confidence,
        notes: `Seasonal + growth approach with incoming orders and time-based weighting (factor=${weightingFactor}).`
      };

      return JSON.stringify(result);

    } catch (error) {
      logger.error('[ReorderCalculator] Error:', error);
      return `[ReorderCalculator] Error: ${error.message}`;
    }
  }
}

module.exports = ReorderCalculator;

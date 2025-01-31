const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');

// Utility to get approximate Z-values for different service levels
function getZValue(serviceLevel) {
  if (serviceLevel >= 0.999) return 3.09;
  if (serviceLevel >= 0.99) return 2.33;
  if (serviceLevel >= 0.975) return 1.96;
  if (serviceLevel >= 0.95) return 1.645;
  if (serviceLevel >= 0.90) return 1.28;
  return 1.0; // fallback
}

// Parse "YYYY-MM" => { year: number, monthIndex: 0..11 }
function parseYearMonth(ym) {
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1; 
  return { year, monthIndex };
}

// Add *integer* months to { year, monthIndex }, returning a new object
function addMonths(yearMonth, numMonths) {
  const newYear = yearMonth.year + Math.floor((yearMonth.monthIndex + numMonths) / 12);
  const newMonthIndex = (yearMonth.monthIndex + numMonths) % 12;
  return {
    year: newYear,
    monthIndex: newMonthIndex
  };
}

// Return just the 0-based month index for the month-of-year (ignore year)
function monthIndexOnly(yearMonth) {
  return yearMonth.monthIndex;
}

class ReorderCalculator extends Tool {
  constructor(fields) {
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
        minOperationalStock: number (optional, default=5)
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
      minOperationalStock: z.number().optional().default(5).describe('Minimum operational stock level')
    });
  }

  async _call(input, _runManager) {
    try {
      logger.info(`[ReorderCalculator] Calculating with seasonality + growth: ${JSON.stringify(input)}`);

      // 1. Parse/validate input
      const {
        salesData,
        leadTime,
        serviceLevel,
        onHandStock,
        annualGrowth,
        safetyStock,
        minOperationalStock
      } = this.schema.parse(input);

      if (!salesData.length) {
        throw new Error('No sales data provided.');
      }

      // 2. Group historical data by month-of-year
      //    dataByMonth[m] = array of all demands in month m (0-based for Jan..Dec)
      const dataByMonth = Array.from({ length: 12 }, () => ({ values: [] }));
      for (const record of salesData) {
        const { month: ym, quantity } = record;
        const parsed = parseYearMonth(ym);
        dataByMonth[parsed.monthIndex].values.push(quantity);
      }

      // 3. Compute average & std dev for each month-of-year
      const avgByMonth = Array(12).fill(0);
      const stdByMonth = Array(12).fill(0);

      for (let m = 0; m < 12; m++) {
        const arr = dataByMonth[m].values;
        if (!arr.length) {
          // no data => set 0
          avgByMonth[m] = 0;
          stdByMonth[m] = 0;
          continue;
        }
        const n = arr.length;
        const mean = arr.reduce((s, x) => s + x, 0) / n;
        avgByMonth[m] = mean;
        if (n > 1) {
          const variance = arr.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
          stdByMonth[m] = Math.sqrt(variance);
        } else {
          stdByMonth[m] = 0; // insufficient data for std dev
        }
      }

      // 4. Convert leadTime (days) -> months
      const leadTimeMonths = leadTime / 30.0;

      // 5. Figure out the "current month" (the last data month in the dataset).
      let latestYear = -Infinity;
      let latestMIndex = -Infinity;
      for (const { month: ym } of salesData) {
        const p = parseYearMonth(ym);
        if (p.year > latestYear) {
          latestYear = p.year;
          latestMIndex = p.monthIndex;
        } else if (p.year === latestYear && p.monthIndex > latestMIndex) {
          latestMIndex = p.monthIndex;
        }
      }
      const currentYM = { year: latestYear, monthIndex: latestMIndex };
      // We'll forecast from the month after that
      const forecastStartYM = addMonths(currentYM, 1);

      // 6. Calculate monthly growth factor
      //    E.g. if annualGrowth=0.10 => monthlyGrowthFactor=(1.10^(1/12)-1) ~0.007974
      const monthlyGrowthFactor = (1 + annualGrowth) ** (1 / 12) - 1;

      // We'll forecast each full month in the lead time plus fraction for the partial month
      const fullMonths = Math.floor(leadTimeMonths);
      const fractionalPart = leadTimeMonths - fullMonths;

      let totalForecast = 0;
      let totalVariance = 0;

      // For each full month i in [0..fullMonths-1], forecast
      // We'll keep a "monthCounter" from 0 upwards for how many months after forecastStartYM
      // so that the growth scaling = (1 + monthlyGrowthFactor)^(monthCounter).
      for (let i = 0; i < fullMonths; i++) {
        // The "pointer" month
        const pointerYM = addMonths(forecastStartYM, i); 
        const mIndex = monthIndexOnly(pointerYM);

        // Base mean & std for that month-of-year
        const baseAvg = avgByMonth[mIndex];
        const baseStd = stdByMonth[mIndex];

        // Growth offset factor
        const factor = (1 + monthlyGrowthFactor) ** i;  
        const scaledAvg = baseAvg * factor;
        const scaledStd = baseStd * factor; // assume std scales with mean

        totalForecast += scaledAvg;
        totalVariance += scaledStd ** 2;
      }

      // Now handle the partial month leftover
      if (fractionalPart > 0) {
        const pointerYM = addMonths(forecastStartYM, fullMonths);
        const mIndex = monthIndexOnly(pointerYM);
        const baseAvg = avgByMonth[mIndex];
        const baseStd = stdByMonth[mIndex];

        // The offset is fullMonths + fraction
        // But for partial month, we typically scale only by the integer part for the growth exponent
        // because "i + fractional" months into the future. 
        // i.e. offset = fullMonths + fractionalPart
        const offset = fullMonths + fractionalPart;  
        const factor = (1 + monthlyGrowthFactor) ** offset;

        const scaledAvg = baseAvg * factor;
        const scaledStd = baseStd * factor;

        // Then only a fraction of that month's demand
        totalForecast += fractionalPart * scaledAvg;
        // For variance, add (fractionalPart^2) * (scaledStd^2)
        totalVariance += (fractionalPart ** 2) * (scaledStd ** 2);
      }

      // So totalForecast is demand over the leadTime (in months) with growth, 
      // totalStdDev is sqrt of totalVariance
      const totalStdDev = Math.sqrt(totalVariance);

      // 7. Safety Stock
      let finalSafetyStock = 0;
      if (typeof safetyStock === 'number') {
        finalSafetyStock = safetyStock;
      } else {
        const zVal = getZValue(serviceLevel);
        finalSafetyStock = zVal * totalStdDev;
      }

      // Enforce minimum operational stock
      if (finalSafetyStock < minOperationalStock) {
        finalSafetyStock = minOperationalStock;
      }

      // 8. Reorder Point
      const reorderPoint = totalForecast + finalSafetyStock;

      // 9. Reorder Quantity
      let reorderQuantity = 0;
      if (onHandStock < reorderPoint) {
        reorderQuantity = Math.ceil(reorderPoint - onHandStock);
      }

      // 10. Simple reorder date heuristic
      //     If onHandStock < reorderPoint => reorder now => "today"
      //     Otherwise, guess how many months until we dip below ROP
      //     (very approximate, ignoring partial months & the fact that monthly usage changes with growth/season.)
      let reorderDate = 'today';
      if (onHandStock >= reorderPoint) {
        // For a naive approach, we might just take the next month’s scaled average usage 
        // as the consumption rate. We'll do offset=0 for the next month:
        const nextMonthYM = addMonths(forecastStartYM, 0);
        const mIndex = monthIndexOnly(nextMonthYM);

        const baseAvg = avgByMonth[mIndex];
        // If we have zero baseAvg, no reorder needed
        if (baseAvg <= 0) {
          reorderDate = 'No reorder needed (zero demand?).';
        } else {
          // scale it for offset=0 => factor=1^0=1, 
          // but let's assume nextMonth average is actually factor^(0) => 1 if we do the naive approach.
          // Or we might do factor^(some small offset). This is up to how you want to approximate.
          const usedAvg = baseAvg; 
          // The months until ROP = (onHandStock - reorderPoint)/ usedAvg
          // but reorderPoint might be bigger. If so, we might get negative => meaning reorder now
          const diff = onHandStock - reorderPoint;
          if (diff > 0) {
            const monthsUntilROP = diff / usedAvg; // approximate
            reorderDate = `in ~${monthsUntilROP.toFixed(1)} months`;
          } else {
            reorderDate = 'today';
          }
        }
      }

      // 11. Return results
      const confidence = salesData.length > 12 ? 0.9 : 0.7;
      const result = {
        demandDuringLeadTime: totalForecast,
        reorderPoint,
        reorderQuantity,
        safetyStock: finalSafetyStock,
        reorderDate,
        confidence,
        notes: 'Seasonal + growth approach (basic).'
      };

      return JSON.stringify(result);

    } catch (error) {
      logger.error('[ReorderCalculator] Error:', error);
      return `[ReorderCalculator] Error: ${error.message}`;
    }
  }
}

module.exports = ReorderCalculator;

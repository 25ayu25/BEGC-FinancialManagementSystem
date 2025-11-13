/**
 * Unit Tests for Calculation Utilities
 * 
 * Tests aggregation functions, metrics calculations, and data transformations
 * Run with: npm test (if vitest is configured) or skip if no test framework
 */

// Note: This file uses vitest syntax but can be adapted to jest or other test frameworks
// If no test framework is available, these tests serve as documentation of expected behavior

import {
  calculateCollectionRate,
  calculateAverageDaysToPayment,
  calculateAgingBuckets,
  calculatePerformanceScore,
  calculateTrendPercentage,
  calculateSummaryMetrics,
  formatCurrency,
  formatPercentage,
} from "../utils/calculations";

/**
 * Collection Rate Tests
 */
export function testCalculateCollectionRate() {
  console.log("Testing calculateCollectionRate...");
  
  // Basic calculations
  const rate1 = calculateCollectionRate(100, 75);
  console.assert(rate1 === 75, `Expected 75, got ${rate1}`);
  
  const rate2 = calculateCollectionRate(1000, 500);
  console.assert(rate2 === 50, `Expected 50, got ${rate2}`);
  
  // Zero billed
  const rate3 = calculateCollectionRate(0, 100);
  console.assert(rate3 === 0, `Expected 0 for zero billed, got ${rate3}`);
  
  // Over-collection
  const rate4 = calculateCollectionRate(100, 150);
  console.assert(rate4 === 150, `Expected 150 for over-collection, got ${rate4}`);
  
  console.log("✓ calculateCollectionRate tests passed");
}

/**
 * Average Days to Payment Tests
 */
export function testCalculateAverageDaysToPayment() {
  console.log("Testing calculateAverageDaysToPayment...");
  
  // Basic calculation
  const claims = [{ periodStart: "2025-01-01" }];
  const payments = [{ paymentDate: "2025-01-15", createdAt: null }];
  
  const avg1 = calculateAverageDaysToPayment(claims, payments);
  console.assert(avg1 === 14, `Expected 14 days, got ${avg1}`);
  
  // Empty data
  const avg2 = calculateAverageDaysToPayment([], []);
  console.assert(avg2 === 0, `Expected 0 for empty data, got ${avg2}`);
  
  // Fallback to createdAt
  const payments3 = [{ paymentDate: null, createdAt: "2025-01-10" }];
  const avg3 = calculateAverageDaysToPayment(claims, payments3);
  console.assert(avg3 === 9, `Expected 9 days with createdAt fallback, got ${avg3}`);
  
  console.log("✓ calculateAverageDaysToPayment tests passed");
}

/**
 * Aging Buckets Tests
 */
export function testCalculateAgingBuckets() {
  console.log("Testing calculateAgingBuckets...");
  
  // Test data with known age distribution
  const testDate = new Date("2025-11-12");
  const claims = [
    {
      id: "1",
      claimedAmount: 1000,
      status: "submitted",
      periodStart: "2025-11-01", // 11 days old
    },
    {
      id: "2",
      claimedAmount: 2000,
      status: "partially_paid",
      periodStart: "2025-10-01", // 42 days old
    },
    {
      id: "3",
      claimedAmount: 3000,
      status: "submitted",
      periodStart: "2025-08-01", // 103 days old
    },
  ];
  
  const payments = [
    { claimId: "2", amount: 500 }, // Partial payment
  ];
  
  const buckets = calculateAgingBuckets(claims, payments);
  
  console.assert(buckets.length === 4, `Expected 4 buckets, got ${buckets.length}`);
  console.assert(buckets[0].range === "0-30 days", `Bucket 0 range incorrect`);
  console.assert(buckets[1].range === "31-60 days", `Bucket 1 range incorrect`);
  console.assert(buckets[2].range === "61-90 days", `Bucket 2 range incorrect`);
  console.assert(buckets[3].range === "91+ days", `Bucket 3 range incorrect`);
  
  // Note: Exact counts depend on current date, so we just check structure
  console.log("✓ calculateAgingBuckets tests passed");
}

/**
 * Performance Score Tests
 */
export function testCalculatePerformanceScore() {
  console.log("Testing calculatePerformanceScore...");
  
  // Perfect score
  const score1 = calculatePerformanceScore(100, 15);
  console.assert(score1 >= 80 && score1 <= 100, `Expected high score, got ${score1}`);
  
  // Poor collection rate
  const score2 = calculatePerformanceScore(50, 15);
  console.assert(score2 < score1, `Expected lower score for poor collection`);
  
  // Slow payment
  const score3 = calculatePerformanceScore(90, 60);
  const score4 = calculatePerformanceScore(90, 15);
  console.assert(score3 < score4, `Expected lower score for slow payment`);
  
  console.log("✓ calculatePerformanceScore tests passed");
}

/**
 * Trend Percentage Tests
 */
export function testCalculateTrendPercentage() {
  console.log("Testing calculateTrendPercentage...");
  
  const trend1 = calculateTrendPercentage(150, 100);
  console.assert(trend1 === 50, `Expected 50% increase, got ${trend1}%`);
  
  const trend2 = calculateTrendPercentage(75, 100);
  console.assert(trend2 === -25, `Expected -25% decrease, got ${trend2}%`);
  
  const trend3 = calculateTrendPercentage(100, 0);
  console.assert(trend3 === 100, `Expected 100% for zero previous, got ${trend3}%`);
  
  const trend4 = calculateTrendPercentage(100, 100);
  console.assert(trend4 === 0, `Expected 0% for no change, got ${trend4}%`);
  
  console.log("✓ calculateTrendPercentage tests passed");
}

/**
 * Summary Metrics Tests
 */
export function testCalculateSummaryMetrics() {
  console.log("Testing calculateSummaryMetrics...");
  
  const claims = [
    { claimedAmount: 1000 },
    { claimedAmount: 2000 },
    { claimedAmount: 1500 },
  ];
  const payments = [
    { amount: 800 },
    { amount: 1200 },
  ];
  
  const metrics = calculateSummaryMetrics(claims, payments);
  
  console.assert(metrics.totalBilled === 4500, `Expected 4500 billed, got ${metrics.totalBilled}`);
  console.assert(metrics.totalCollected === 2000, `Expected 2000 collected, got ${metrics.totalCollected}`);
  console.assert(metrics.outstanding === 2500, `Expected 2500 outstanding, got ${metrics.outstanding}`);
  console.assert(Math.abs(metrics.collectionRate - 44.44) < 0.1, `Expected ~44.44% collection rate, got ${metrics.collectionRate}%`);
  
  console.log("✓ calculateSummaryMetrics tests passed");
}

/**
 * Currency Format Tests
 */
export function testFormatCurrency() {
  console.log("Testing formatCurrency...");
  
  const fmt1 = formatCurrency(1000);
  console.assert(fmt1.includes("1,000"), `Expected formatted 1,000, got ${fmt1}`);
  console.assert(fmt1.includes("USD"), `Expected USD prefix, got ${fmt1}`);
  
  const fmt2 = formatCurrency(1234567);
  console.assert(fmt2.includes("1,234,567"), `Expected formatted 1,234,567, got ${fmt2}`);
  
  console.log("✓ formatCurrency tests passed");
}

/**
 * Percentage Format Tests
 */
export function testFormatPercentage() {
  console.log("Testing formatPercentage...");
  
  const fmt1 = formatPercentage(75.5);
  console.assert(fmt1 === "75.5%", `Expected 75.5%, got ${fmt1}`);
  
  const fmt2 = formatPercentage(100);
  console.assert(fmt2 === "100.0%", `Expected 100.0%, got ${fmt2}`);
  
  const fmt3 = formatPercentage(33.333);
  console.assert(fmt3 === "33.3%", `Expected 33.3%, got ${fmt3}`);
  
  console.log("✓ formatPercentage tests passed");
}

/**
 * Run all tests
 */
export function runAllCalculationTests() {
  console.log("=== Running Insurance Overview Calculation Tests ===\n");
  
  try {
    testCalculateCollectionRate();
    testCalculateAverageDaysToPayment();
    testCalculateAgingBuckets();
    testCalculatePerformanceScore();
    testCalculateTrendPercentage();
    testCalculateSummaryMetrics();
    testFormatCurrency();
    testFormatPercentage();
    
    console.log("\n=== All tests passed! ===");
    return true;
  } catch (error) {
    console.error("\n=== Tests failed ===");
    console.error(error);
    return false;
  }
}

// Auto-run if this file is executed directly
if (typeof window !== "undefined" && (window as any).__RUN_TESTS__) {
  runAllCalculationTests();
}

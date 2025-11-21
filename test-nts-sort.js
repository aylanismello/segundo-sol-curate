/**
 * Test script to find the correct sorting parameter for NTS API
 *
 * This will try common parameter patterns and show which ones work
 */

const baseUrl = 'https://www.nts.live/api/v2/search?q=bonobo&version=2&offset=0&limit=10&types[]=track';

// Common sorting parameter patterns to try
const sortPatterns = [
  // Pattern 1: sort + order
  '&sort=local_date&order=desc',
  '&sort=local_date&order=asc',

  // Pattern 2: sort_by + sort_order
  '&sort_by=local_date&sort_order=desc',
  '&sort_by=local_date&sort_order=asc',

  // Pattern 3: orderBy + direction
  '&orderBy=local_date&direction=desc',
  '&orderBy=local_date&direction=asc',

  // Pattern 4: sortBy alone
  '&sortBy=local_date',
  '&sortBy=-local_date', // minus sign for descending

  // Pattern 5: sort alone
  '&sort=local_date',
  '&sort=-local_date',

  // Pattern 6: order_by
  '&order_by=local_date',
  '&order_by=-local_date',

  // Pattern 7: date variations
  '&sort=date&order=desc',
  '&sort_by=date&sort_order=desc',
];

async function testSortPattern(pattern) {
  const url = baseUrl + pattern;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Get first 3 dates from results
    const dates = data.results?.slice(0, 3).map(r => r.local_date) || [];

    return {
      pattern,
      success: true,
      firstDates: dates,
      totalResults: data.results?.length || 0
    };
  } catch (error) {
    return {
      pattern,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('Testing NTS API sorting parameters...\n');
  console.log('Base URL:', baseUrl, '\n');

  // First, get baseline (no sorting params)
  console.log('=== BASELINE (no sort params) ===');
  const baseline = await testSortPattern('');
  console.log('First 3 dates:', baseline.firstDates);
  console.log('Total results:', baseline.totalResults);
  console.log('\n');

  // Test each pattern
  for (const pattern of sortPatterns) {
    console.log(`Testing: ${pattern}`);
    const result = await testSortPattern(pattern);

    if (result.success) {
      console.log('✓ Request successful');
      console.log('  First 3 dates:', result.firstDates);

      // Check if order is different from baseline
      const isDifferent = JSON.stringify(result.firstDates) !== JSON.stringify(baseline.firstDates);
      if (isDifferent) {
        console.log('  🎯 ORDER CHANGED! This parameter might work!');
      }
    } else {
      console.log('✗ Request failed:', result.error);
    }
    console.log('');

    // Small delay to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=== SUMMARY ===');
  console.log('Look for patterns marked with 🎯 - those changed the order!');
}

runTests();

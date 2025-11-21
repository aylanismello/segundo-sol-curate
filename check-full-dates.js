/**
 * Check all dates returned by the API to see current ordering
 */

async function checkDates() {
  const url = 'https://www.nts.live/api/v2/search?q=bonobo&version=2&offset=0&limit=60&types[]=track';

  const response = await fetch(url);
  const data = await response.json();

  console.log('All dates returned (in order):');
  console.log('===============================\n');

  data.results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.local_date} - ${result.title}`);
  });

  // Check if it's sorted
  const dates = data.results.map(r => new Date(r.local_date));
  const isDescending = dates.every((date, i) => i === 0 || dates[i - 1] >= date);
  const isAscending = dates.every((date, i) => i === 0 || dates[i - 1] <= date);

  console.log('\n===============================');
  console.log('Analysis:');
  console.log(`Total results: ${data.results.length}`);
  console.log(`Already sorted descending (newest first)? ${isDescending}`);
  console.log(`Already sorted ascending (oldest first)? ${isAscending}`);

  if (!isDescending && !isAscending) {
    console.log('Not sorted by date - appears to be relevance-based ordering');
  }
}

checkDates();

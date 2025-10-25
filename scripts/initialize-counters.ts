/**
 * One-time script to initialize event counters from existing data
 * 
 * IMPORTANT: This script needs Firebase credentials which are only available
 * in the browser environment (via Vite's import.meta.env).
 * 
 * To initialize counters:
 * 1. Open your browser Developer Console (F12)
 * 2. Navigate to your deployed app's Admin Dashboard
 * 3. Run this code in the console:
 * 
 * ```javascript
 * (async () => {
 *   const { rebuildEventStats, getEventStats } = await import('./services/eventStats');
 *   const { getYearKey } = await import('./services/participants');
 *   const events = ["OPENING","RB1","TERRACE1","SOUPS","COCKTAIL","TERRACE2","RB2","TERRACE3","PRIZES"];
 *   const year = getYearKey();
 *   console.log('🔄 Initializing counters for', year);
 *   for (const eventKey of events) {
 *     console.log('⏳', eventKey);
 *     const stats = await rebuildEventStats(year, eventKey);
 *     console.log('✅', eventKey, stats);
 *   }
 *   console.log('🎉 Done!');
 * })();
 * ```
 * 
 * OR use the Admin Dashboard UI button if available.
 */

// This file is kept for documentation purposes.
// For actual initialization, use the browser console method above
// or add a temporary button to the Admin Dashboard.

console.log(`
⚠️  This script cannot run directly in Node.js because Firebase credentials
    are only available in the browser via Vite's environment variables.

To initialize counters, please use ONE of these methods:

METHOD 1: Browser Console (Recommended)
--------------------------------------
1. Open your app in the browser
2. Navigate to /admin
3. Open Developer Console (F12)
4. Copy and paste this code:

(async () => {
  const { rebuildEventStats } = await import('/src/services/eventStats.ts');
  const { getYearKey } = await import('/src/services/participants.ts');
  const events = ["OPENING","RB1","TERRACE1","SOUPS","COCKTAIL","TERRACE2","RB2","TERRACE3","PRIZES"];
  const year = getYearKey();
  console.log('🔄 Initializing counters for year:', year);
  for (const eventKey of events) {
    try {
      console.log('⏳ Processing', eventKey, '...');
      const stats = await rebuildEventStats(year, eventKey);
      console.log('✅', eventKey + ':', stats.participants, 'participants |', stats.totalEligibleAdults, 'eligible |', stats.totalConsumedAdults, 'consumed');
    } catch (error) {
      console.error('❌ Error processing', eventKey + ':', error);
    }
  }
  console.log('🎉 Counter initialization complete!');
})();

METHOD 2: Temporary Admin Dashboard Button
------------------------------------------
Add this button temporarily to AdminDashboard.tsx:

<Button onClick={async () => {
  const events = ["OPENING","RB1","TERRACE1","SOUPS","COCKTAIL","TERRACE2","RB2","TERRACE3","PRIZES"];
  for (const eventKey of events) {
    await rebuildEventStats(getYearKey(), eventKey);
  }
  alert('Counters initialized!');
}}>
  Initialize All Counters (One-Time)
</Button>

`);

process.exit(1);

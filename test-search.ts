import mongoose from 'mongoose';
import { extractIntent } from './src/services/openaiService';
import { findNearbyProviders } from './src/services/locationService';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fetcha';

const testPhrases = [
  'I need a barber',
  'find me a tailor',
  'I want food',
  'bukka nearby',
  'photographer please',
  'I need plumbing',
  'hello',
  'xyz',
];

const testLocation = {
  lat: 6.5244,
  lng: 3.3792,
}; // Lagos, Nigeria

(async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Intent Extraction
    console.log('='.repeat(60));
    console.log('TEST 1: Intent Extraction');
    console.log('='.repeat(60));
    for (const phrase of testPhrases) {
      try {
        console.log(`\n📝 Testing: "${phrase}"`);
        const intent = await extractIntent(phrase);
        console.log(`   ✅ Result: serviceType="${intent.serviceType}", locationHint="${intent.locationHint}"`);
      } catch (error) {
        console.log(`   ❌ Error:`, (error as any).message);
      }
    }

    // Test 2: Provider Search
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Provider Search');
    console.log('='.repeat(60));
    const serviceTypes = ['hair_beauty', 'fashion', 'food', 'photography', 'home_services'];
    for (const serviceType of serviceTypes) {
      try {
        console.log(`\n🔍 Searching for "${serviceType}" providers near (${testLocation.lat}, ${testLocation.lng})`);
        const providers = await findNearbyProviders({
          lat: testLocation.lat,
          lng: testLocation.lng,
          serviceType,
        });
        console.log(`   ✅ Found ${providers.length} provider(s)`);
        if (providers.length > 0) {
          providers.forEach((p, i) => {
            console.log(`      [${i + 1}] ${p.name} (${p.distance.toFixed(2)}km, trust=${p.trustScore})`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Error:`, (error as any).message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test complete');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
  }
})();

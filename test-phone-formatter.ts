import { formatPhoneForDisplay, formatPhoneForWhatsApp } from './src/utils/phoneFormatter';

console.log('\n=== Phone Formatter Test ===\n');

const testCases = [
  // Raw WhatsApp JID formats
  { input: '236360891949056', type: 'WhatsApp JID (234...)' },
  { input: '2349041622162', type: 'WhatsApp JID (234...)' },
  
  // Display formats
  { input: '+2349041622162', type: 'E.164 (+234...)' },
  { input: '09041622162', type: 'Local (0...)' },
  
  // With @c.us or @lid
  { input: '236360891949056@c.us', type: 'With @c.us suffix' },
  { input: '2349041622162@lid', type: 'With @lid suffix' },
  { input: '+2349041622162@g.us', type: 'With @g.us suffix' },
];

console.log('TEST 1: formatPhoneForDisplay (raw → display)');
console.log('─'.repeat(70));
testCases.forEach(({ input, type }) => {
  const output = formatPhoneForDisplay(input);
  console.log(`\n  Input:  ${input}`);
  console.log(`  Type:   ${type}`);
  console.log(`  Output: ${output}`);
  console.log(`  ✓ ${output.startsWith('+') ? 'Formatted correctly' : 'WARNING: Missing +'}`);
});

console.log('\n\nTEST 2: formatPhoneForWhatsApp (display → JID for sending)');
console.log('─'.repeat(70));
const displayFormats = [
  { input: '+2349041622162', format: 'lid' },
  { input: '09041622162', format: 'lid' },
  { input: '+2349041622162', format: 'c.us' },
  { input: '09041622162', format: 'c.us' },
];

displayFormats.forEach(({ input, format }) => {
  const output = formatPhoneForWhatsApp(input, format as 'c.us' | 'lid');
  console.log(`\n  Input:  ${input} (format: ${format})`);
  console.log(`  Output: ${output}`);
  const hasCorrectFormat = output.includes('@' + format);
  console.log(`  ✓ ${hasCorrectFormat ? 'Correct format' : 'ERROR: Wrong format'}`);
});

console.log('\n\nTEST 3: Full workflow (Raw → Display → JID for sending)');
console.log('─'.repeat(70));
const rawJid = '236360891949056';
const display = formatPhoneForDisplay(rawJid);
const jidForSending = formatPhoneForWhatsApp(display, 'lid');

console.log(`\n  Step 1 (Raw):       ${rawJid}`);
console.log(`  Step 2 (Display):   ${display}`);
console.log(`  Step 3 (For Send):  ${jidForSending}`);
console.log(`\n  ✓ Full workflow complete!`);

console.log('\n=== All Tests Complete ===\n');

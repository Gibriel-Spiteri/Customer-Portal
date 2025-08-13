// Test openid-client import methods
async function testImport() {
  console.log('Testing openid-client import methods...\n');
  
  try {
    // Method 1: Dynamic import
    console.log('Method 1: Dynamic import');
    const module1 = await import('openid-client');
    console.log('  Keys:', Object.keys(module1));
    console.log('  Has Issuer?', 'Issuer' in module1);
    console.log('  Has default?', 'default' in module1);
    if (module1.default) {
      console.log('  Default keys:', Object.keys(module1.default));
    }
    console.log();
    
    // Try to access Issuer
    const Issuer = module1.Issuer || module1.default?.Issuer || module1.default;
    console.log('  Issuer type:', typeof Issuer);
    console.log('  Issuer:', Issuer ? 'Found' : 'Not found');
    
  } catch (error) {
    console.error('Import failed:', error.message);
  }
}

testImport();
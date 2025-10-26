#!/usr/bin/env tsx

import { QuoteModule } from '../src/modules/quote/index.js';

async function testListings() {
    console.log('[LAUNCH] Testing Quote Module - Get Listings Feature\n');
    
    const quoteModule = new QuoteModule();
    await quoteModule.initialize();
    
    // Test ADA listings
    console.log('[LIST] Testing ADA Listings...');
    const adaListings = await quoteModule.getListings('ADA');
    
    console.log(`\n[SUCCESS] ADA is listed on ${adaListings.filter(l => l.isListed).length} out of ${adaListings.length} exchanges`);
    
    const listedExchanges = adaListings.filter(l => l.isListed);
    console.log('\n[DATA] Listed Exchanges:');
    listedExchanges.forEach(listing => {
        const spot = listing.spotPrice ? `$${listing.spotPrice.toFixed(4)}` : 'N/A';
        const perp = listing.perpPrice ? `$${listing.perpPrice.toFixed(4)}` : 'N/A';
        console.log(`• ${listing.exchange}: Spot ${spot}, Perp ${perp}`);
    });
    
    // Test a less common token
    console.log('\n[LIST] Testing PEPE Listings...');
    const pepeListings = await quoteModule.getListings('PEPE');
    
    console.log(`\n[SUCCESS] PEPE is listed on ${pepeListings.filter(l => l.isListed).length} out of ${pepeListings.length} exchanges`);
    
    const pepeListedExchanges = pepeListings.filter(l => l.isListed);
    if (pepeListedExchanges.length > 0) {
        console.log('\n[DATA] Listed Exchanges:');
        pepeListedExchanges.forEach(listing => {
            const spot = listing.spotPrice ? `$${listing.spotPrice.toFixed(8)}` : 'N/A';
            const perp = listing.perpPrice ? `$${listing.perpPrice.toFixed(8)}` : 'N/A';
            console.log(`• ${listing.exchange}: Spot ${spot}, Perp ${perp}`);
        });
    } else {
        console.log('[ERROR] PEPE is not listed on any of the checked exchanges');
    }
    
    console.log('\n[COMPLETE] Quote Module Listings Test Complete!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    testListings().catch(console.error);
}

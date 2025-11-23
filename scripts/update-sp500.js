const https = require('https');
const fs = require('fs');

const url = 'https://datahub.io/core/s-and-p-500-companies/r/constituents.csv';

https.get(url, (res) => {
    let csvData = '';

    res.on('data', (chunk) => {
        csvData += chunk;
    });

    res.on('end', () => {
        const lines = csvData.trim().split('\n');
        const stocks = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            // Simple CSV parser (handles quoted fields)
            const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < 4) continue;

            const cleanValue = (val) => val ? val.replace(/^"|"$/g, '').trim() : '';

            stocks.push({
                symbol: cleanValue(matches[0]),
                name: cleanValue(matches[1]),
                sector: cleanValue(matches[2]),
                subSector: cleanValue(matches[3]),
                headQuarter: matches[4] ? cleanValue(matches[4]) : '',
                dateFirstAdded: matches[5] ? cleanValue(matches[5]) : '',
                cik: matches[6] ? cleanValue(matches[6]) : '',
                founded: matches[7] ? cleanValue(matches[7]) : ''
            });
        }

        const outputPath = './src/lib/sp500.json';
        fs.writeFileSync(outputPath, JSON.stringify(stocks, null, 2));
        console.log(`✅ Successfully converted ${stocks.length} S&P 500 stocks to JSON`);
        console.log(`📁 Saved to: ${outputPath}`);
    });
}).on('error', (err) => {
    console.error('❌ Error:', err.message);
});

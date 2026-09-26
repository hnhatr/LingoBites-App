const fs = require('fs');

let content = fs.readFileSync('src/shared/api/authenticatedFetch.ts', 'utf8');
content = content.replace(/initHeaders\?: HeadersInit,/, 'initHeaders?: any,');
fs.writeFileSync('src/shared/api/authenticatedFetch.ts', content);

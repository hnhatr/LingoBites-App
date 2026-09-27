import http from 'node:http';

const port = Number(process.argv[2] ?? 41293);
const practiceSeen = new Set();
const reviewSeen = new Set();

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (req.url === '/v1/review-events' && req.method === 'POST') {
      const accepted_ids = [];
      const duplicate_ids = [];
      for (const event of body.events ?? []) {
        if (reviewSeen.has(event.id)) {
          duplicate_ids.push(event.id);
        } else {
          reviewSeen.add(event.id);
          accepted_ids.push(event.id);
        }
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(
        JSON.stringify({
          request_id: 'ios-char',
          status: 'success',
          accepted: accepted_ids.length,
          duplicates: duplicate_ids.length,
          accepted_ids,
          duplicate_ids,
        }),
      );
      return;
    }
    if (
      req.url === '/characterization/inv002-result' &&
      req.method === 'POST'
    ) {
      const payload = Buffer.concat(chunks).toString('utf8');
      process.stdout.write(`[LING93_INV002] ${payload}\n`);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === '/v1/practice-events:batch' && req.method === 'POST') {
      const accepted_ids = [];
      const duplicate_ids = [];
      for (const event of body.events ?? []) {
        const id = event.event_id;
        if (practiceSeen.has(id)) {
          duplicate_ids.push(id);
        } else {
          practiceSeen.add(id);
          accepted_ids.push(id);
        }
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({accepted_ids, duplicate_ids, rejected: []}));
      return;
    }
    res.writeHead(404);
    res.end();
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `${JSON.stringify({
      status: 'listening',
      port,
      practiceEffects: () => practiceSeen.size,
      reviewEffects: () => reviewSeen.size,
    })}\n`,
  );
});

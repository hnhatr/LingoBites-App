import http from 'node:http';

const port = Number(process.argv[2] ?? 41293);
const practiceSeen = new Set();
const reviewSeen = new Set();
let practicePosts = 0;
let reviewPosts = 0;
let practiceFailRemaining = 0;
let reviewFailRemaining = 0;

function statsPayload() {
  return {
    practicePosts,
    reviewPosts,
    practiceEffects: practiceSeen.size,
    reviewEffects: reviewSeen.size,
    practiceFailRemaining,
    reviewFailRemaining,
  };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : {};

    if (req.url === '/characterization/inv002-stats' && req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(statsPayload()));
      return;
    }

    if (req.url === '/characterization/inv002-config' && req.method === 'POST') {
      practiceFailRemaining = Number(body.practiceFailFirst ?? 0);
      reviewFailRemaining = Number(body.reviewFailFirst ?? 0);
      res.writeHead(204);
      res.end();
      return;
    }

    if (
      req.url === '/characterization/inv002-result' &&
      req.method === 'POST'
    ) {
      process.stdout.write(`[LING93_INV002] ${bodyText}\n`);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/v1/review-events' && req.method === 'POST') {
      reviewPosts += 1;
      if (reviewFailRemaining > 0) {
        reviewFailRemaining -= 1;
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({status: 'unavailable', message: 'injected'}));
        return;
      }
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

    if (req.url === '/v1/practice-events:batch' && req.method === 'POST') {
      practicePosts += 1;
      if (practiceFailRemaining > 0) {
        practiceFailRemaining -= 1;
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({status: 'unavailable', message: 'injected'}));
        return;
      }
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
    })}\n`,
  );
});

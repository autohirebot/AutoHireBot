// IndexNow submission utility
// Run: node functions/submit-indexnow.js
// This notifies Bing, Yandex, and other search engines about your pages

const https = require('https');

const INDEXNOW_KEY = 'autohirebot2026indexnow';
const HOST = 'autohirebot.com';

const URLS = [
  'https://autohirebot.com/',
  'https://autohirebot.com/jobs',
  'https://autohirebot.com/register/seeker',
  'https://autohirebot.com/register/recruiter',
  'https://autohirebot.com/resume/',
  'https://autohirebot.com/blog/',
  'https://autohirebot.com/blog/blog-staff-nurse-salary-india.html',
  'https://autohirebot.com/blog/blog-gnm-vs-bsc-nursing.html',
  'https://autohirebot.com/blog/blog-nursing-interview-questions.html',
  'https://autohirebot.com/blog/blog-nursing-jobs-delhi.html',
  'https://autohirebot.com/blog/blog-nursing-jobs-hyderabad.html',
  'https://autohirebot.com/blog/blog-aiims-nursing-recruitment.html',
];

const payload = JSON.stringify({
  host: HOST,
  key: INDEXNOW_KEY,
  keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
  urlList: URLS,
});

const engines = ['api.indexnow.org', 'www.bing.com', 'yandex.com'];

engines.forEach(engine => {
  const options = {
    hostname: engine,
    port: 443,
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = https.request(options, (res) => {
    console.log(`${engine}: ${res.statusCode} ${res.statusMessage}`);
    res.on('data', (d) => process.stdout.write(d));
  });

  req.on('error', (e) => console.error(`${engine} error:`, e.message));
  req.write(payload);
  req.end();
});

console.log(`\nSubmitted ${URLS.length} URLs to ${engines.length} search engines via IndexNow`);

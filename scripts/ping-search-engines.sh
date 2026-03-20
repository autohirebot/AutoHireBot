#!/bin/bash
# Ping search engines to notify them of sitemap updates
# Run after deploying: bash scripts/ping-search-engines.sh

SITEMAP_URL="https://autohirebot.com/sitemap.xml"

echo "Pinging Google..."
curl -s "https://www.google.com/ping?sitemap=${SITEMAP_URL}" -o /dev/null -w "Google: HTTP %{http_code}\n"

echo "Pinging Bing via IndexNow..."
curl -s -X POST "https://www.bing.com/indexnow" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "autohirebot.com",
    "key": "autohirebot2026indexnow",
    "keyLocation": "https://autohirebot.com/autohirebot2026indexnow.txt",
    "urlList": [
      "https://autohirebot.com/",
      "https://autohirebot.com/jobs",
      "https://autohirebot.com/register/seeker",
      "https://autohirebot.com/register/recruiter",
      "https://autohirebot.com/blog/",
      "https://autohirebot.com/resume/"
    ]
  }' -o /dev/null -w "Bing IndexNow: HTTP %{http_code}\n"

echo "Pinging Yandex via IndexNow..."
curl -s -X POST "https://yandex.com/indexnow" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "autohirebot.com",
    "key": "autohirebot2026indexnow",
    "keyLocation": "https://autohirebot.com/autohirebot2026indexnow.txt",
    "urlList": [
      "https://autohirebot.com/",
      "https://autohirebot.com/jobs",
      "https://autohirebot.com/blog/"
    ]
  }' -o /dev/null -w "Yandex IndexNow: HTTP %{http_code}\n"

echo ""
echo "Done! Next steps:"
echo "1. Verify Google Search Console: https://search.google.com/search-console"
echo "2. Verify Bing Webmaster Tools: https://www.bing.com/webmasters"
echo "3. Submit sitemap manually in both consoles"
echo "4. Use 'URL Inspection' in GSC to request indexing for key pages"

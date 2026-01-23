#!/bin/bash

# Test script for API rate limiting and protection
# This will help verify that rate limits are working correctly

set -e

API_ENDPOINT="${1:-http://localhost:3000/api/contact}"
REQUESTS="${2:-15}"

echo "🧪 Testing API Rate Limiting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: $API_ENDPOINT"
echo "Requests: $REQUESTS"
echo ""

# Create temp file for results
RESULTS_FILE=$(mktemp)

echo "📤 Sending $REQUESTS requests rapidly..."
echo ""

# Send requests in parallel
for i in $(seq 1 $REQUESTS); do
  {
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"Test User $i\",\"email\":\"test$i@example.com\",\"company\":\"Test Corp\",\"message\":\"Rate limit test\"}" \
      2>/dev/null)

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    echo "$i|$HTTP_CODE|$BODY" >> "$RESULTS_FILE"
  } &
done

# Wait for all requests to complete
wait

echo "✅ All requests completed"
echo ""

# Analyze results
TOTAL=$(wc -l < "$RESULTS_FILE")
SUCCESS=$(grep -c "|200|" "$RESULTS_FILE" || true)
RATE_LIMITED=$(grep -c "|429|" "$RESULTS_FILE" || true)
OTHER_ERRORS=$(grep -c -v "|200\||429|" "$RESULTS_FILE" || true)

echo "📊 Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Requests:     $TOTAL"
echo "Successful (200):   $SUCCESS"
echo "Rate Limited (429): $RATE_LIMITED"
echo "Other Errors:       $OTHER_ERRORS"
echo ""

if [ "$RATE_LIMITED" -gt 0 ]; then
  echo "✅ Rate limiting is WORKING! ($RATE_LIMITED requests were blocked)"
else
  echo "⚠️  No rate limiting detected. Check WAF and API Gateway configuration."
fi

echo ""
echo "Detailed breakdown:"
sort "$RESULTS_FILE" | while IFS='|' read -r num code body; do
  if [ "$code" = "429" ]; then
    echo "  Request #$num: ❌ $code (Rate Limited)"
  elif [ "$code" = "200" ]; then
    echo "  Request #$num: ✅ $code (Success)"
  else
    echo "  Request #$num: ⚠️  $code (Error)"
  fi
done

# Cleanup
rm "$RESULTS_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Expected behavior with WAF enabled:"
echo "   - First 10 requests: Success (200)"
echo "   - Remaining requests: Rate Limited (429)"
echo ""
echo "   If using mailto: approach (no API),"
echo "   all requests will succeed locally."

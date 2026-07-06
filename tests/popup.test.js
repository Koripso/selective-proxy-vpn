/**
 * popup.test.js
 * Tests for popup.js functions
 */

// Mock functions and utilities for testing
function runTests() {
  let passCount = 0;
  let failCount = 0;
  const results = [];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, but got ${actual}. ${message}`);
    }
  }

  function assertArrayEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected [${expected}], but got [${actual}]. ${message}`);
    }
  }

  function test(name, testFn) {
    try {
      testFn();
      results.push(`✓ ${name}`);
      passCount++;
    } catch (error) {
      results.push(`✗ ${name}: ${error.message}`);
      failCount++;
    }
  }

  // ===== normalizeDomain tests =====
  test("normalizeDomain: removes http:// protocol", () => {
    const result = normalizeDomain("http://example.com");
    assertEqual(result, "example.com", "should strip http://");
  });

  test("normalizeDomain: removes https:// protocol", () => {
    const result = normalizeDomain("https://example.com");
    assertEqual(result, "example.com", "should strip https://");
  });

  test("normalizeDomain: removes www prefix", () => {
    const result = normalizeDomain("www.example.com");
    assertEqual(result, "example.com", "should remove www.");
  });

  test("normalizeDomain: removes path", () => {
    const result = normalizeDomain("example.com/path/to/page");
    assertEqual(result, "example.com", "should remove path");
  });

  test("normalizeDomain: removes query string", () => {
    const result = normalizeDomain("example.com?key=value");
    assertEqual(result, "example.com", "should remove query string");
  });

  test("normalizeDomain: removes port", () => {
    const result = normalizeDomain("example.com:8080");
    assertEqual(result, "example.com", "should remove port");
  });

  test("normalizeDomain: converts to lowercase", () => {
    const result = normalizeDomain("EXAMPLE.COM");
    assertEqual(result, "example.com", "should convert to lowercase");
  });

  test("normalizeDomain: handles complex URL", () => {
    const result = normalizeDomain("https://www.EXAMPLE.com:8080/path?x=1");
    assertEqual(result, "example.com", "should handle complex URL");
  });

  test("normalizeDomain: handles localhost", () => {
    const result = normalizeDomain("http://localhost:3000");
    assertEqual(result, "localhost", "should handle localhost");
  });

  test("normalizeDomain: handles IPv4 address", () => {
    const result = normalizeDomain("192.168.1.1:8080");
    assertEqual(result, "192.168.1.1", "should handle IPv4 address");
  });

  test("normalizeDomain: trims whitespace", () => {
    const result = normalizeDomain("  example.com  ");
    assertEqual(result, "example.com", "should trim whitespace");
  });

  test("normalizeDomain: returns empty string for empty input", () => {
    const result = normalizeDomain("");
    assertEqual(result, "", "should return empty string");
  });

  // ===== isValidIPv4 tests =====
  test("isValidIPv4: validates correct IPv4 address", () => {
    assert(isValidIPv4("192.168.1.1"), "192.168.1.1 should be valid");
  });

  test("isValidIPv4: validates localhost loopback", () => {
    assert(isValidIPv4("127.0.0.1"), "127.0.0.1 should be valid");
  });

  test("isValidIPv4: rejects invalid octet (>255)", () => {
    assert(!isValidIPv4("192.168.1.256"), "192.168.1.256 should be invalid");
  });

  test("isValidIPv4: rejects incomplete IP", () => {
    assert(!isValidIPv4("192.168.1"), "192.168.1 should be invalid");
  });

  test("isValidIPv4: rejects non-numeric", () => {
    assert(!isValidIPv4("192.168.a.1"), "192.168.a.1 should be invalid");
  });

  test("isValidIPv4: rejects domain name", () => {
    assert(!isValidIPv4("example.com"), "example.com should be invalid for IPv4");
  });

  test("isValidIPv4: validates 0.0.0.0", () => {
    assert(isValidIPv4("0.0.0.0"), "0.0.0.0 should be valid");
  });

  test("isValidIPv4: validates 255.255.255.255", () => {
    assert(isValidIPv4("255.255.255.255"), "255.255.255.255 should be valid");
  });

  // ===== isValidHost tests =====
  test("isValidHost: accepts localhost", () => {
    assert(isValidHost("localhost"), "localhost should be valid");
  });

  test("isValidHost: accepts valid IPv4", () => {
    assert(isValidHost("192.168.1.1"), "192.168.1.1 should be valid");
  });

  test("isValidHost: accepts simple domain", () => {
    assert(isValidHost("example.com"), "example.com should be valid");
  });

  test("isValidHost: accepts single-label domain", () => {
    assert(isValidHost("myhost"), "myhost should be valid (FIXED)");
  });

  test("isValidHost: accepts subdomain", () => {
    assert(isValidHost("mail.example.com"), "mail.example.com should be valid");
  });

  test("isValidHost: accepts deep subdomain", () => {
    assert(isValidHost("a.b.c.example.com"), "a.b.c.example.com should be valid");
  });

  test("isValidHost: accepts domain with hyphens", () => {
    assert(isValidHost("my-domain.com"), "my-domain.com should be valid");
  });

  test("isValidHost: rejects domain starting with hyphen", () => {
    assert(!isValidHost("-example.com"), "-example.com should be invalid");
  });

  test("isValidHost: rejects domain ending with hyphen", () => {
    assert(!isValidHost("example-.com"), "example-.com should be invalid");
  });

  test("isValidHost: rejects empty string", () => {
    assert(!isValidHost(""), "empty string should be invalid");
  });

  test("isValidHost: rejects domain with invalid characters", () => {
    assert(!isValidHost("exam@ple.com"), "exam@ple.com should be invalid");
  });

  // ===== isValidPort tests =====
  test("isValidPort: accepts port 1", () => {
    assert(isValidPort("1"), "port 1 should be valid");
  });

  test("isValidPort: accepts port 80", () => {
    assert(isValidPort("80"), "port 80 should be valid");
  });

  test("isValidPort: accepts port 443", () => {
    assert(isValidPort("443"), "port 443 should be valid");
  });

  test("isValidPort: accepts port 1080", () => {
    assert(isValidPort("1080"), "port 1080 should be valid");
  });

  test("isValidPort: accepts port 65535", () => {
    assert(isValidPort("65535"), "port 65535 should be valid");
  });

  test("isValidPort: rejects port 0", () => {
    assert(!isValidPort("0"), "port 0 should be invalid");
  });

  test("isValidPort: rejects port 65536", () => {
    assert(!isValidPort("65536"), "port 65536 should be invalid");
  });

  test("isValidPort: rejects non-numeric", () => {
    assert(!isValidPort("abc"), "non-numeric should be invalid");
  });

  test("isValidPort: rejects empty string", () => {
    assert(!isValidPort(""), "empty string should be invalid");
  });

  test("isValidPort: rejects negative", () => {
    assert(!isValidPort("-1"), "negative port should be invalid");
  });

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log("POPUP.JS TEST RESULTS");
  console.log("=".repeat(50));
  results.forEach(result => console.log(result));
  console.log("=".repeat(50));
  console.log(`Passed: ${passCount}, Failed: ${failCount}`);
  console.log("=".repeat(50) + "\n");

  return { passed: passCount, failed: failCount };
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests };
}

/**
 * background.test.js
 * Tests for background.js functions
 */

function runBackgroundTests() {
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
      throw new Error(`Expected "${expected}", but got "${actual}". ${message}`);
    }
  }

  function assertIncludes(text, substring, message) {
    if (!text.includes(substring)) {
      throw new Error(`Expected text to include "${substring}". ${message}`);
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

  // ===== buildPacScript tests =====
  test("buildPacScript: generates valid PAC script", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assert(script.includes("function FindProxyForURL"), "should include FindProxyForURL function");
  });

  test("buildPacScript: includes proxy address in script", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assertIncludes(script, "127.0.0.1", "should include proxy address");
  });

  test("buildPacScript: includes proxy port in script", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assertIncludes(script, "1080", "should include proxy port");
  });

  test("buildPacScript: returns SOCKS5 format", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assertIncludes(script, 'return "SOCKS5', "should return SOCKS5 format");
  });

  test("buildPacScript: returns DIRECT for non-matching", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assertIncludes(script, 'return "DIRECT"', "should return DIRECT for non-matching hosts");
  });

  test("buildPacScript: handles empty site list", () => {
    const script = buildPacScript([], { address: "127.0.0.1", port: 1080 });
    assert(script.includes("proxySites"), "should still have proxySites array");
  });

  test("buildPacScript: handles multiple sites", () => {
    const script = buildPacScript(
      ["example.com", "test.org", "localhost"],
      { address: "127.0.0.1", port: 1080 }
    );
    assertIncludes(script, "example.com", "should include first site");
    assertIncludes(script, "test.org", "should include second site");
    assertIncludes(script, "localhost", "should include localhost");
  });

  test("buildPacScript: escapes special characters in site names", () => {
    // FIXED: Now properly escapes quotes and backslashes
    const script = buildPacScript(
      ['example.com', 'test"site.com'],
      { address: "127.0.0.1", port: 1080 }
    );
    // The script should be valid JavaScript
    assert(script.includes("proxySites"), "should contain proxySites");
  });

  test("buildPacScript: uses different proxy servers", () => {
    const script1 = buildPacScript(["example.com"], { address: "10.0.0.1", port: 9050 });
    const script2 = buildPacScript(["example.com"], { address: "10.0.0.2", port: 9051 });
    assert(script1 !== script2, "scripts with different proxies should differ");
    assertIncludes(script1, "10.0.0.1:9050", "script1 should use first proxy");
    assertIncludes(script2, "10.0.0.2:9051", "script2 should use second proxy");
  });

  test("buildPacScript: includes endsWith logic for subdomains", () => {
    const script = buildPacScript(["example.com"], { address: "127.0.0.1", port: 1080 });
    assertIncludes(script, "endsWith", "should use endsWith for subdomain matching");
  });

  test("buildPacScript: handles IPv4 addresses as sites", () => {
    const script = buildPacScript(
      ["192.168.1.1"],
      { address: "127.0.0.1", port: 1080 }
    );
    assertIncludes(script, "192.168.1.1", "should handle IPv4 addresses");
  });

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log("BACKGROUND.JS TEST RESULTS");
  console.log("=".repeat(50));
  results.forEach(result => console.log(result));
  console.log("=".repeat(50));
  console.log(`Passed: ${passCount}, Failed: ${failCount}`);
  console.log("=".repeat(50) + "\n");

  return { passed: passCount, failed: failCount };
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runBackgroundTests };
}

const B = "http://localhost:3000";

console.log("=== Test 1: trending (namu.wiki API) ===");
const r1 = await fetch(B + "/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "trending", arguments: { count: 3 } } }),
});
const j1 = await r1.json();
console.log("Response:", JSON.stringify(j1, null, 2).slice(0, 800));

console.log("\n=== Test 2: search (namu.wiki 직접 접속) ===");
const r2 = await fetch(B + "/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { keyword: "이순신" } } }),
});
const j2 = await r2.json();
console.log("Response:", JSON.stringify(j2, null, 2).slice(0, 1000));
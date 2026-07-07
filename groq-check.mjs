// throwaway Groq diagnostic — run:  GROQ_API="gsk_xxx,gsk_yyy" node groq-check.mjs
// (or on Windows PowerShell:  $env:GROQ_API="gsk_xxx"; node groq-check.mjs )
// Tests the EXACT request shape the support + deposit code sends. Delete after use.

const raw = process.env.GROQ_API || process.argv[2] || "";
const key = String(raw).split(/[\s,;|]+/).map(s => s.trim()).filter(Boolean)[0] || "";
if (!key) { console.error("❌ No key. Set GROQ_API or pass it as the first arg."); process.exit(1); }
console.log(`Using key: ${key.slice(0, 6)}…${key.slice(-4)} (len ${key.length}, starts gsk_ = ${key.startsWith("gsk_")})\n`);

const URL = "https://api.groq.com/openai/v1/chat/completions";

async function call(label, body) {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let short = text;
    try { const j = JSON.parse(text); short = j.error ? JSON.stringify(j.error) : (j.choices?.[0]?.message?.content?.slice(0, 80) ?? text.slice(0, 200)); } catch {}
    console.log(`${res.ok ? "✅" : "❌"} ${label}: HTTP ${res.status} — ${short}\n`);
  } catch (e) { console.log(`❌ ${label}: threw ${e?.name} ${e?.message}\n`); }
}

// 1x1 transparent PNG (for the vision test)
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

console.log("=== Support (text) ===");
await call("gpt-oss-120b (primary, json+reasoning_effort)", {
  model: "openai/gpt-oss-120b", stream: false, temperature: 0.2, max_tokens: 300,
  response_format: { type: "json_object" }, reasoning_effort: "low",
  messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
});
await call("llama-3.3-70b-versatile (fallback, json)", {
  model: "llama-3.3-70b-versatile", stream: false, temperature: 0.2, max_tokens: 300,
  response_format: { type: "json_object" },
  messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
});

console.log("=== Deposit image reading (vision) ===");
await call("llama-4-scout (reads receipt image)", {
  model: "meta-llama/llama-4-scout-17b-16e-instruct", stream: false, temperature: 0, max_tokens: 200,
  messages: [{ role: "user", content: [
    { type: "text", text: "What color is this image? One word." },
    { type: "image_url", image_url: { url: png } },
  ] }],
});

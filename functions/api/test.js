export async function onRequest(context) {
  return new Response(JSON.stringify({ success: true, message: 'Hello from Cloudflare Functions!' }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

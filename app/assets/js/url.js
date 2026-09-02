export const encodeForQuery = async (obj) => {
  const jsonBlob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const readable = jsonBlob.stream();
  const compressedStream = readable.pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(compressedStream).arrayBuffer();
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return encodeURIComponent(btoa(binary));
};

export const decodeFromQuery = async (param) => {
  if (!param) {
    return [];
  }

  const binary = atob(decodeURIComponent(param));
  const bytes = new Uint8Array([...binary].map(ch => ch.charCodeAt(0)));
  const cs = new DecompressionStream('gzip');
  const ds = new Response(bytes).body.pipeThrough(cs);
  const decompressed = await new Response(ds).arrayBuffer();
  const txt = new TextDecoder().decode(decompressed);
  return JSON.parse(txt);
};

// PA04-T08: proxy thử cho lần chạy held-out, giống môi trường người chấm: container checker không có
// network, chỉ ra ngoài qua proxy này, và proxy chỉ cho đi tới model host.
// Chỉ nhận CONNECT (HTTPS) tới các host:port trong ALLOW_HOSTS; mọi yêu cầu khác bị từ chối 403.
// Mỗi kết nối ghi một dòng JSON ra stdout (host, cho phép hay từ chối), không ghi nội dung.
//
//   ALLOW_HOSTS=api.anthropic.com:443 PORT=3128 node scripts/held-out-proxy.mjs
import { createServer } from 'node:http';
import { connect } from 'node:net';

const port = Number(process.env.PORT ?? 3128);
const allowed = new Set(
  (process.env.ALLOW_HOSTS ?? 'api.anthropic.com:443')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h !== ''),
);

const log = (entry) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));

const server = createServer((req, res) => {
  log({ method: req.method, target: req.url, allowed: false });
  res.writeHead(403, { 'content-type': 'text/plain' });
  res.end('Only CONNECT to the model host is allowed.\n');
});

server.on('connect', (req, client, head) => {
  const target = String(req.url ?? '').toLowerCase();
  if (!allowed.has(target)) {
    log({ method: 'CONNECT', target, allowed: false });
    client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }
  log({ method: 'CONNECT', target, allowed: true });
  const [host, portText] = target.split(':');
  const upstream = connect(Number(portText), host, () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length > 0) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    client.destroy();
  };
  upstream.on('error', close);
  client.on('error', close);
});

server.listen(port, '0.0.0.0', () =>
  log({ listening: port, allow: [...allowed] }),
);

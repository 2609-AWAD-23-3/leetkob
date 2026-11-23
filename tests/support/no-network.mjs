// Preload cho test checker (PA03-T10): mọi cố gắng mở kết nối network đều ném lỗi và làm
// process thoát với mã 97, để test chứng minh `MODEL_OFF=1` không mở network.
import dns from 'node:dns';
import net from 'node:net';

const blocked = (what) => {
  process.stderr.write(`NETWORK BLOCKED: ${what}\n`);
  process.exit(97);
};

net.Socket.prototype.connect = function connect() {
  blocked('net.Socket.connect');
};
net.connect = () => blocked('net.connect');
net.createConnection = () => blocked('net.createConnection');
dns.lookup = () => blocked('dns.lookup');
globalThis.fetch = () => blocked('fetch');

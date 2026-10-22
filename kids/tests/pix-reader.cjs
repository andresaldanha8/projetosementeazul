// Independent JS BR Code reader. Does not import or reuse the PHP encoder/CRC.
const assert = require('node:assert/strict');
const table = Array.from({ length: 256 }, (_, byte) => {
  let remainder = byte * 256;
  for (let bit = 0; bit < 8; bit++) remainder = remainder >= 32768 ? (remainder * 2) ^ 0x11021 : remainder * 2;
  return remainder;
});
function crc(text) {
  let value = 65535;
  for (const byte of Buffer.from(text, 'ascii')) value = ((value * 256) & 65535) ^ table[(value >>> 8) ^ byte];
  return value.toString(16).toUpperCase().padStart(4, '0');
}
function fields(text) {
  const result = {};
  for (let offset = 0; offset < text.length;) {
    const header = text.slice(offset, offset + 4);
    assert.match(header, /^\d{4}$/);
    const id = header.slice(0, 2), length = Number(header.slice(2));
    assert.ok(length > 0 && offset + 4 + length <= text.length, 'TLV length');
    assert.equal(Object.hasOwn(result, id), false, 'duplicate tag');
    result[id] = text.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return result;
}
function read(payload) {
  assert.match(payload, /^[\x20-\x7e]+$/);
  assert.match(payload, /6304[0-9A-F]{4}$/);
  const parsed = fields(payload);
  assert.equal(parsed['63'], crc(payload.slice(0, -4)), 'CRC16/CCITT-FALSE');
  assert.equal(parsed['00'], '01');
  assert.equal(parsed['52'], '0000');
  assert.equal(parsed['53'], '986');
  assert.equal(parsed['58'], 'BR');
  const account = fields(parsed['26']);
  assert.equal(account['00'], 'br.gov.bcb.pix');
  assert.equal(fields(parsed['62'])['05'], '***');
  assert.ok(parsed['59'].length <= 25 && parsed['60'].length <= 15);
  if (parsed['54']) assert.match(parsed['54'], /^\d+\.\d{2}$/);
  return { key: account['01'], amount: parsed['54'], name: parsed['59'], city: parsed['60'] };
}
assert.equal(crc('123456789'), '29B1');
// Published BCB static BR Code example, section 2.6.3 (CRC 1D3D).
read('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');
module.exports = read;

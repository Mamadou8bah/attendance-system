const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '----FormBoundary' + Date.now();
const filePath = path.join(__dirname, 'uploads', 'student-1765568884631-305164107.jpg');
const fileName = path.basename(filePath);
const fileContent = fs.readFileSync(filePath);

let body = '';
body += `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="name"\r\n\r\n`;
body += `NodeJSTest\r\n`;
body += `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="photos"; filename="${fileName}"\r\n`;
body += `Content-Type: image/jpeg\r\n\r\n`;

const endBoundary = `\r\n--${boundary}--\r\n`;
const bodyBuffer = Buffer.concat([
  Buffer.from(body),
  fileContent,
  Buffer.from(endBoundary)
]);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/students',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': bodyBuffer.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(bodyBuffer);
req.end();

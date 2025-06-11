// Example: Express route to generate a pre-signed URL
import * as Minio from 'minio';
import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors()); // Enable CORS for all origins

const minioUrl = process.env.MINIO_URL;
const minioAccessKey = process.env.MINIO_ACCESS_KEY;
const minioSecretKey = process.env.MINIO_SECRET_KEY;

const minioClient = new Minio.Client({
  endPoint: minioUrl,
  port: 9000,
  useSSL: false,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
});

const upload = multer();

// Get presigned URL for file upload
app.get('/presignedUrl', (req, res) => {
  const { name } = req.query;
  minioClient.presignedPutObject('media-uploads', name, (err, url) => {
    if (err) return res.status(500).send(err.message);
    res.send(url);
  });
});

// Upload file to Minio
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  minioClient.putObject(
    'media-uploads',
    file.originalname,
    file.buffer,
    file.mimetype,
    (err, etag) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'File uploaded successfully', etag });
    }
  );
});

// Get all files from Minio
app.get('/files', (req, res) => {
  const files = minioClient.listObjects('media-uploads', '', true);
  res.json(files);
});

// Get all files from Minio
app.get('/files-list', async (req, res) => {
  const files = [];
  const stream = minioClient.listObjects('media-uploads', '', true);
  stream.on('data', obj => {
    files.push({
      name: obj.name,
      size: obj.size,
      lastModified: obj.lastModified,
      // Optionally, add more fields as needed
    });
  });
  stream.on('end', () => {
    res.json(files);
  });
  stream.on('error', err => {
    res.status(500).json({ error: err.message });
  });
});


// Get a specific file from Minio
app.get('/files/:filename', (req, res) => {
  const { filename } = req.params;
  // First, get the file's metadata to determine the Content-Type
  minioClient.statObject('media-uploads', filename, (err, stat) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    // Set the Content-Type header to the file's mimetype
    if (stat.metaData && stat.metaData['content-type']) {
      res.setHeader('Content-Type', stat.metaData['content-type']);
    }
    minioClient.getObject('media-uploads', filename, (err, dataStream) => {
      if (err) {
        return res.status(404).json({ error: 'File not found' });
      }
      dataStream.pipe(res);
      dataStream.on('error', (streamErr) => {
        res.status(500).json({ error: 'Error streaming file' });
      });
    });
  });
});

// Get a presigned GET URL for a file (for use in <img> tags, etc.)
app.get('/file-url/:filename', (req, res) => {
  const { filename } = req.params;
  // 10 minutes expiry (600 seconds)
  minioClient.presignedGetObject('media-uploads', filename, 600, (err, url) => {
    if (err) {
      return res.status(500).json({ error: 'Could not generate presigned URL' });
    }
    res.json({ url });
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
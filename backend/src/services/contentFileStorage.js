const fs = require('fs');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');

const BUCKET_NAME = 'contentUploads';

function bucket() {
  if (!mongoose.connection.db) throw new Error('Database is not ready for file storage.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

async function storeContentUpload(file) {
  if (!file?.path) return null;
  const upload = bucket().openUploadStream(file.originalname || file.filename || 'upload', {
    metadata: { contentType: file.mimetype || 'application/octet-stream' },
  });
  try {
    await pipeline(fs.createReadStream(file.path), upload);
    return {
      id: String(upload.id),
      path: `gridfs:${upload.id}`,
      contentType: file.mimetype || 'application/octet-stream',
    };
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
}

function contentFileUrl(req, id) {
  return `${req.protocol}://${req.get('host')}/api/public/content/files/${id}`;
}

async function streamContentFile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const id = new mongoose.Types.ObjectId(req.params.id);
  const files = await bucket().find({ _id: id }).limit(1).toArray();
  if (!files.length) return res.status(404).end();
  const file = files[0];
  res.setHeader('Content-Type', file.metadata?.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${String(file.filename || 'file').replace(/["\r\n]/g, '')}"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  bucket().openDownloadStream(id)
    .on('error', (error) => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy(error);
    })
    .pipe(res);
}

module.exports = { storeContentUpload, contentFileUrl, streamContentFile };

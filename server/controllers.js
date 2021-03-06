const multiparty = require('multiparty');
const AWS = require('aws-sdk');
const fs = require('fs');
const fileType = require('file-type');
const bluebird = require('bluebird');
const { SkateLog } = require('../database-mongo');
const Sharp = require('sharp');


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

AWS.config.setPromisesDependency(bluebird);

const s3 = new AWS.S3();

const uploadFile = (buffer, name, type) => {
  const params = {
    ACL: 'public-read',
    Body: buffer,
    Bucket: process.env.S3_BUCKET,
    ContentType: type.mime,
    Key: `${name}.${type.ext}`,
  };
  return s3.upload(params).promise();
};

module.exports.getAll = (req, res) => {
  SkateLog.find()
    .sort([['date', -1]])
    .exec((error, logs) => {
      if (error) {
        res.sendStatus(500);
      } else {
        res.status(200).json(logs);
      }
    });
};

module.exports.addSession = (request, response) => {
  const form = new multiparty.Form();
  form.parse(request, async (error, fields, files) => {
    if (error) throw new Error(error);
    try {
      const { date, location, notes } = fields;
      const { path } = files.file[0];
      await Sharp(path)
        .resize(null, 250, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer()
        .then(async buffer => {
          const type = fileType(buffer);
          const timestamp = Date.now().toString();
          const fileName = `bucketFolder/${timestamp}-lg`;
          const data = await uploadFile(buffer, fileName, type);
          await SkateLog.create({
            date: date[0],
            location: location[0],
            footy: data.Location,
            notes: notes[0],
            fileName: fileName,
          }, (err) => {
            if (err) throw new Error(err);
          });
          return response.status(200).send(data);
        })
        .catch(err => {
          if (err) throw new Error(err);
        })
      // const buffer = fs.readFileSync(path);
      // for resizing look into Jimp npm package
    } catch (error) {
      return response.status(400).send(error);
    }
  });
};

module.exports.deleteLog = (req, res) => {
  let params = {
    Bucket: process.env.S3_BUCKET, 
    Key: req.query.fileName
   };
   s3.deleteObject(params, function(err, data) {
     if (err) console.log(err, err.stack); // an error occurred
     else {
       SkateLog.deleteOne({ _id: req.query.id }, (error, data) => {
         if (error) {
           res.sendStatus(500);
         } else {
           res.sendStatus(200);
         }
       });
     }
   });
};

module.exports.getAllCoordinates = (req, res) => {
  SkateLog.find({ location: /\d+/ })
    .exec((err, data) => {
      if (err) {
        res.sendStatus(400);
      } else {
        res.json(data);
      }
    });
};

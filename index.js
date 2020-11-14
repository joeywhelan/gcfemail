/**
 * @fileoverview Google Cloud Function that will accept an email with attachments via multi-part POST
 * @author Joey Whelan <joey.whelan@gmail.com>
 */

const {Storage} = require('@google-cloud/storage');
const {v4: uuidv4} = require('uuid');
const Busboy = require('busboy');

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET);  //bucket name stored as GCF environment var

/**
 * Function that stores an email file attachment to Google Cloud Storage (GCS)
 * @param {string} name - filename to be stored in GCS
 * @param {file} file - file object to be stored in GCS
 * @return {promise} 
 * @throws {Error} propagates file/GCS exceptions
 */
function save(name, file) {	
	return new Promise((resolve, reject) => {
		file.pipe(bucket.file(name).createWriteStream())
		.on('error', reject)
		.on('finish', resolve);
	});
}

/**
 * Function that parses an multi-part form and sends the file attachments to GCS
 * @param {Request} req - Expressjs Request object
 * @return {promise} 
 * @throws {Error} propagates exceptions
 */
function upload(req) {
	return new Promise((resolve, reject) => {
		const busboy = new Busboy({headers: req.headers});
		const writes = [];
		const folder = uuidv4() + '/'; 

		busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
			console.log(`File received: ${filename}`);
			writes.push(save(folder + filename, file));
		});

		busboy.on('finish', async () => {
			console.log('Form parsed');
			await Promise.all(writes);
			resolve();
		});

		busboy.end(req.rawBody);
	});
}

/**
 * GCF HTTP trigger function
 * @param {Request} req - Expressjs Request object
 * @param {Response} res - Expressjs Response object
 */
exports.uploadRma = (req, res) => {
	if (req.method === 'POST') {
		if (req.query.key === process.env.API_KEY) {  
			upload(req)
			.then(() => {
				res.status(200).send('');
			})
			.catch((err) => {
				console.err(err);
				res.status(200).send(''); //naive error handling, but without a 2xx response cloudmailin
										  //will continue to try to POST the email
			});
		}
		else {
			res.status(403).send('');
		}
	}
	else {
		res.status(405).send('');
	} 
};
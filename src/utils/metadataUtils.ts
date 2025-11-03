import fs from 'fs';
import path from 'path';

export function saveMetadata(
	fileLocation: string,
	requestParams: any,
	successInfo?: any,
	error?: Error | string
) {
	const metadata = {
		requestParams,
		successInfo,
		error: error ? (typeof error === 'string' ? error : error.message) : undefined,
		timestamp: new Date().toISOString(),
	};

	// Create the metadata file path (same directory, .txt extension)
	const metadataPath = path.join(
		path.dirname(fileLocation),
		path.basename(fileLocation, path.extname(fileLocation)) + '.txt'
	);

	// Write the metadata as JSON to the file
	fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

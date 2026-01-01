import crypto from 'crypto';



export function generateACRCloudSignature(
    method: string,
    uri: string,
    accessKey: string,
    accessSecret: string,
    dataType: string,
    signatureVersion: string,
    timestamp: string
): string {
    const stringToSign = [
        method,
        uri,
        accessKey,
        dataType,
        signatureVersion,
        timestamp
    ].join('\n');

    return crypto
        .createHmac('sha1', accessSecret)
        .update(stringToSign)
        .digest('base64');
}

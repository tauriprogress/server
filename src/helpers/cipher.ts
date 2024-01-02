import * as crypto from "crypto";
import environment from "../environment";

const key = crypto
    .createHash("sha1")
    .update(environment.ENCRYPTION_KEY)
    .digest()
    .subarray(0, 16);

const algorithm = "aes-128-cbc";

function encrypt(text: string) {
    let cipher = crypto.createCipheriv(algorithm, key, key);

    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return encrypted.toString("hex");
}

function decrypt(text: string) {
    let encryptedText = Buffer.from(text, "hex");

    let decipher = crypto.createDecipheriv(algorithm, key, key);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}

export default {
    encrypt,
    decrypt,
};

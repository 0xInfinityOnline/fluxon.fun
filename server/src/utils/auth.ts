import jwt, { JwtPayload, VerifyErrors } from 'jsonwebtoken';
import { config } from 'dotenv';

config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  userId: string;
  email: string;
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = async (token: string): Promise<JWTPayload> => {
  return new Promise((resolve, reject) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      resolve(decoded);
    } catch (err) {
      reject(err);
    }
  });
};

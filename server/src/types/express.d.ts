import { JWTPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

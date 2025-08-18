import { Request, Response, NextFunction } from 'express';

export {};

declare global {
  namespace Express {
    interface Request {
      user?: any; // You can replace 'any' with a more specific user type if available
    }
  }
}

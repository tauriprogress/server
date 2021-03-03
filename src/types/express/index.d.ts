declare namespace Express {
    interface Request {
        db: import("../../database").DatabaseType;
    }
}

import { ExpressRequestPatreonUser } from "./request";
declare global {
    namespace Express {
        export interface Request {
            user?: ExpressRequestPatreonUser;
        }
    }
}

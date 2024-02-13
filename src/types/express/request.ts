import { PatreonUserInfo } from "../patreonApi";

export type ExpressRequestPatreonUser = undefined | ValidUser | InvalidUser;

interface ValidUser extends PatreonUserInfo {
    invalid: false;
}

type InvalidUser = {
    invalid: Invalidity;
};

type Invalidity = "expired" | "bad token";

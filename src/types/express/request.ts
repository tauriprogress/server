import { PatreonUserInfo } from "../patreonApi";

export type ExpressRequestPatreonUser = undefined | ValidUser | InvalidUser;

type ValidUser = PatreonUserInfo;

type InvalidUser = {
    invalid: "invalid";
};

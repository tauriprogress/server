import * as cookie from "cookie";
import { Response } from "express";
import environment from "../environment";

function setUserCookie(res: Response, token: string) {
    res.setHeader(
        "Set-Cookie",
        cookie.serialize("user", token, {
            httpOnly: true,
            sameSite: "none",
            secure: true,
            domain: environment.CORS_ORIGIN,
            partitioned: true,
        })
    );
}

function removeUserCookie(res: Response) {
    res.setHeader(
        "Set-Cookie",
        cookie.serialize("user", "", {
            maxAge: 0,
        })
    );
}

export default {
    setUserCookie,
    removeUserCookie,
};

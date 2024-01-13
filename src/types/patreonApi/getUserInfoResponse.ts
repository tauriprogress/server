export type PatreonUserId = string;

export interface GetUserInfoResponse {
    data: {
        attributes: Object;
        id: PatreonUserId;
        relationships: {
            memberships: { data: any[] };
        };
        type: "user";
    };
    links: { self: string };
}

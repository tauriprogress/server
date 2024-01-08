export interface GetUserInfoResponse {
    data: {
        attributes: Object;
        id: string;
        relationships: {
            memberships: { data: any[] };
        };
        type: "user";
    };
    links: { self: string };
}

import z from "zod";

export const RelationalID = z.uuidv4().brand('RelationalID')
export type RelationalID = z.infer<typeof RelationalID>

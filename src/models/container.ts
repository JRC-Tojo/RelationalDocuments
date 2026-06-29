import z from 'zod';

export const ContainerID = z.uuidv4().brand('ContainerID');
export type ContainerID = z.infer<typeof ContainerID>;

export const ContainerElementFile = z.object({
  containerID: ContainerID,
  type: z.literal('File'),
  path: z.string(),
  fileSize: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastViewedAt: z.date().optional(),
  description: z.string().optional().default(''),
  genre: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
});
export type ContainerElementFile = z.infer<typeof ContainerElementFile>;
export const ContainerElementFolder = z.object({
  containerID: ContainerID,
  type: z.literal('Folder'),
  path: z.string(),
  createdAt: z.date(),
});
export type ContainerElementFolder = z.infer<typeof ContainerElementFolder>;
export const ContainerElement = z.discriminatedUnion('type', [
  ContainerElementFile,
  ContainerElementFolder,
]);
export type ContainerElement = z.infer<typeof ContainerElement>;

export const ContainerType = z.enum(['box', 'cache', 'local']);
export type ContainerType = z.infer<typeof ContainerType>;
export const ContainerSkel = z.object({
  id: ContainerID,
  name: z.string(),
  type: ContainerType,
  containerPath: z.string(),
});
export type ContainerSkel = z.infer<typeof ContainerSkel>;
export const Container = ContainerSkel.extend({
  elements: z.record(z.string(), ContainerElement),
});
export type Container = z.infer<typeof Container>;
